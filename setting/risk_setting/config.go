package risk_setting

import (
	"slices"
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
)

// TokenRiskEventType 定义风控事件的类型，同时用于数据库 event_type 列的取值。
const (
	// RiskEventConcurrentFp 表示同一令牌同时存在多个不同客户端指纹的在途请求。
	RiskEventConcurrentFp = "concurrent_fp"
	// RiskEventSingleFpConcurrency 表示单一指纹的在途请求数异常高，常见于二级网关聚合转发。
	RiskEventSingleFpConcurrency = "single_fp_concurrency"
	// RiskEventFpBurst 表示单一令牌当日出现的不同指纹数超过阈值。
	RiskEventFpBurst = "fp_burst"
	// RiskEventFpCrossUser 表示同一客户端指纹出现在多个不同用户的请求中。
	RiskEventFpCrossUser = "fp_cross_user"
)

// RiskEventStatus 定义风控事件的处理状态。
const (
	// RiskEventStatusPending 表示事件待管理员处理。
	RiskEventStatusPending = 0
	// RiskEventStatusIgnored 表示事件已被管理员忽略。
	RiskEventStatusIgnored = 1
)

type RiskSetting struct {
	// Enabled 控制整个令牌分发风控功能（指纹计算、计数与事件写入）是否启用。
	Enabled bool `json:"enabled"`
	// FingerprintSalt 是客户端指纹 HMAC 的盐，首次启动自动生成并持久化，永不轮换。
	FingerprintSalt string `json:"fingerprint_salt"`
	// MaxConcurrentFingerprints 是同一令牌允许的同时在途不同指纹数阈值，0 表示关闭该信号。
	MaxConcurrentFingerprints int `json:"max_concurrent_fingerprints"`
	// MaxConcurrentRequestsPerFingerprint 是单一指纹允许的同时在途请求数阈值，0 表示关闭该信号。
	MaxConcurrentRequestsPerFingerprint int `json:"max_concurrent_requests_per_fingerprint"`
	// DailyFingerprintThreshold 是单一令牌单日不同指纹数阈值，0 表示关闭该信号。
	DailyFingerprintThreshold int `json:"daily_fingerprint_threshold"`
	// MinRequestsPerFingerprint 是指纹计入日多样性统计所需的最小请求数，用于过滤随机 UA 制造的一次性指纹。
	MinRequestsPerFingerprint int `json:"min_requests_per_fingerprint"`
	// CrossUserThreshold 是同一指纹关联的不同用户数阈值，0 表示关闭该信号。
	CrossUserThreshold int `json:"cross_user_threshold"`
	// TrustedTokenIds 是管理员设置的信任令牌白名单，名单内令牌不参与任何风控检测。
	TrustedTokenIds []int `json:"trusted_token_ids"`
}

var (
	riskSetting = RiskSetting{
		Enabled:                             true,
		FingerprintSalt:                     "",
		MaxConcurrentFingerprints:           3,
		MaxConcurrentRequestsPerFingerprint: 20,
		DailyFingerprintThreshold:           10,
		MinRequestsPerFingerprint:           3,
		CrossUserThreshold:                  3,
		TrustedTokenIds:                     []int{},
	}
	mutex sync.RWMutex
)

func init() {
	config.GlobalConfig.Register("risk_setting", &riskSetting)
}

// GetSetting 返回当前风控配置的快照。
func GetSetting() RiskSetting {
	mutex.RLock()
	defer mutex.RUnlock()
	return riskSetting
}

// SetFingerprintSalt 设置指纹盐的内存值。盐由中间件在首次使用时生成并经
// model.UpdateOption 持久化，之后由配置系统从数据库加载，永不轮换。
func SetFingerprintSalt(salt string) {
	mutex.Lock()
	defer mutex.Unlock()
	riskSetting.FingerprintSalt = salt
}

// IsTrustedToken 判断令牌是否在管理员信任白名单内。
func IsTrustedToken(tokenId int) bool {
	mutex.RLock()
	defer mutex.RUnlock()
	return slices.Contains(riskSetting.TrustedTokenIds, tokenId)
}
