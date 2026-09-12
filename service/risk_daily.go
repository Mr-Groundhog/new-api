package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/risk_setting"
)

// 日多样性与跨用户聚类的 Redis 结构（TTL 兜底自动过期，数据丢失静默降级）：
//
//	risk:fpday:{token_id}:{yyyyMMdd}    HyperLogLog，PFADD 指纹 → 当日 distinct 指纹数
//	risk:fpcount:{token_id}:{yyyyMMdd}  Hash，field=指纹 value=请求数 → 过滤一次性指纹
//	risk:fpusers:{fp}                   Set，member=user_id → 指纹跨用户聚类
const (
	riskDailyKeyTTL   = 8 * 24 * time.Hour
	riskFpUsersKeyTTL = 7 * 24 * time.Hour
)

// RecordRiskFingerprintDaily 登记一次指纹观测，供每日任务聚合。Redis 不可用时
// 静默跳过（聚类信号缺失不阻塞主流程）。调用方需保证 fp 非空且已过滤白名单。
func RecordRiskFingerprintDaily(tokenId, userId int, fp string) {
	if !common.RedisEnabled || common.RDB == nil || fp == "" || tokenId <= 0 {
		return
	}
	now := time.Now()
	day := now.Format("20060102")
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	pipe := common.RDB.TxPipeline()
	pipe.PFAdd(ctx, fmt.Sprintf("risk:fpday:%d:%s", tokenId, day), fp)
	pipe.HIncrBy(ctx, fmt.Sprintf("risk:fpcount:%d:%s", tokenId, day), fp, 1)
	usersKey := fmt.Sprintf("risk:fpusers:%s", fp)
	pipe.SAdd(ctx, usersKey, userId)
	pipe.Expire(ctx, usersKey, riskFpUsersKeyTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		common.SysError("risk fingerprint daily record failed: " + err.Error())
	}
}

// RunRiskDailyScan 扫描前一天的日多样性数据与跨用户聚类数据，产出 fp_burst /
// fp_cross_user 风控事件。作为每日系统任务执行（DB 租约保证多实例单跑）。
func RunRiskDailyScan() {
	if !common.RedisEnabled || common.RDB == nil {
		return
	}
	setting := risk_setting.GetSetting()
	if !setting.Enabled {
		return
	}
	yesterday := time.Now().AddDate(0, 0, -1).Format("20060102")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if setting.DailyFingerprintThreshold > 0 {
		scanDailyFingerprints(ctx, yesterday, setting)
	}
	if setting.CrossUserThreshold > 0 {
		scanCrossUserFingerprints(ctx, setting)
	}
}

// scanDailyFingerprints 遍昨日 risk:fpday:*，对 distinct 指纹数超阈值的令牌
// 进一步要求"有效指纹"（请求数 >= MinRequestsPerFingerprint）也超阈值，
// 过滤随机 UA 制造的一次性指纹。
func scanDailyFingerprints(ctx context.Context, day string, setting risk_setting.RiskSetting) {
	var cursor uint64
	for {
		keys, next, err := common.RDB.Scan(ctx, cursor, "risk:fpday:*:"+day, 100).Result()
		if err != nil {
			common.SysError("risk daily scan failed: " + err.Error())
			return
		}
		for _, key := range keys {
			tokenId, ok := tokenIdFromRiskKey(key, "risk:fpday:")
			if !ok || risk_setting.IsTrustedToken(tokenId) {
				continue
			}
			distinct, err := common.RDB.PFCount(ctx, key).Result()
			if err != nil || distinct < int64(setting.DailyFingerprintThreshold) {
				continue
			}
			counts, err := common.RDB.HGetAll(ctx, fmt.Sprintf("risk:fpcount:%d:%s", tokenId, day)).Result()
			if err != nil {
				continue
			}
			valid := 0
			for _, raw := range counts {
				if n, err := strconv.ParseInt(raw, 10, 64); err == nil && n >= int64(setting.MinRequestsPerFingerprint) {
					valid++
				}
			}
			if valid < setting.DailyFingerprintThreshold {
				continue
			}
			userId := riskTokenUserId(tokenId)
			evidence := fmt.Sprintf(`{"distinct_fingerprints":%d,"valid_fingerprints":%d,"threshold":%d}`,
				distinct, valid, setting.DailyFingerprintThreshold)
			model.RecordTokenRiskEventFromSample(userId, tokenId, risk_setting.RiskEventFpBurst, evidence, time.Now())
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
}

// scanCrossUserFingerprints 遍 risk:fpusers:*，对关联不同用户数超阈值的指纹
// 记录 fp_cross_user 事件（事件归属为指纹下请求数最多的令牌所属用户）。
func scanCrossUserFingerprints(ctx context.Context, setting risk_setting.RiskSetting) {
	var cursor uint64
	for {
		keys, next, err := common.RDB.Scan(ctx, cursor, "risk:fpusers:*", 100).Result()
		if err != nil {
			common.SysError("risk cross-user scan failed: " + err.Error())
			return
		}
		for _, key := range keys {
			fp := strings.TrimPrefix(key, "risk:fpusers:")
			if fp == "" {
				continue
			}
			users, err := common.RDB.SMembers(ctx, key).Result()
			if err != nil || len(users) < setting.CrossUserThreshold {
				continue
			}
			recordCrossUserEvent(ctx, fp, users, setting)
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
}

// recordCrossUserEvent 将跨用户指纹事件记到该指纹下请求数最多的令牌上。
// risk:fpcount 只按 (token, day) 维度记录，找"最多请求"的令牌需要回查近 8 天
// 的 fpcount key，量级可控（每指纹每天每令牌一行）。
func recordCrossUserEvent(ctx context.Context, fp string, users []string, setting risk_setting.RiskSetting) {
	bestTokenId, bestCount := 0, int64(0)
	var cursor uint64
	for {
		keys, next, err := common.RDB.Scan(ctx, cursor, "risk:fpcount:*", 100).Result()
		if err != nil {
			return
		}
		for _, key := range keys {
			tokenId, ok := tokenIdFromRiskKey(key, "risk:fpcount:")
			if !ok {
				continue
			}
			raw, err := common.RDB.HGet(ctx, key, fp).Result()
			if err != nil {
				continue
			}
			if n, err := strconv.ParseInt(raw, 10, 64); err == nil && n > bestCount {
				bestTokenId, bestCount = tokenId, n
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	userId := 0
	if bestTokenId > 0 {
		if risk_setting.IsTrustedToken(bestTokenId) {
			return
		}
		userId = riskTokenUserId(bestTokenId)
	}
	evidence := fmt.Sprintf(`{"fingerprint":%q,"user_ids":%q,"user_count":%d,"threshold":%d}`,
		fp, users, len(users), setting.CrossUserThreshold)
	model.RecordTokenRiskEventFromSample(userId, bestTokenId, risk_setting.RiskEventFpCrossUser, evidence, time.Now())
}

// tokenIdFromRiskKey 从形如 risk:{prefix}{token_id}:{day} 的 key 解析 token_id。
// prefix 之后的第一个冒号前的段是 token_id；末尾的日期段由调用方剪除。
func tokenIdFromRiskKey(key, prefix string) (int, bool) {
	rest, _, found := strings.Cut(strings.TrimPrefix(key, prefix), ":")
	if !found {
		return 0, false
	}
	tokenId, err := strconv.Atoi(rest)
	if err != nil || tokenId <= 0 {
		return 0, false
	}
	return tokenId, true
}

// riskTokenUserId 查询令牌所属用户 ID，令牌不存在时返回 0。
func riskTokenUserId(tokenId int) int {
	token, err := model.GetTokenById(tokenId)
	if err != nil || token == nil {
		return 0
	}
	return token.UserId
}
