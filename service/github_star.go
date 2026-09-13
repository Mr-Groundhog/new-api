package service

import (
	"context"
	"crypto/rsa"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/golang-jwt/jwt/v5"
)

// GitHub Star 检测的低层技术参数（内置常量，不对外配置）。
const (
	// githubStarApiBaseUrl GitHub API 地址；如需接入 GitHub Enterprise 可改为
	// 企业实例地址。
	githubStarApiBaseUrl = "https://api.github.com"
	// githubStarApiVersion X-GitHub-Api-Version 请求头的值。使用 GitHub 长期
	// 稳定的 GA 版本；传入不支持的版本号会导致所有请求返回 400。
	githubStarApiVersion = "2022-11-28"
	// githubStarApiTimeout 单次 GitHub API 请求超时。
	githubStarApiTimeout = 10 * time.Second
	// githubStarPageSize Stargazers 分页大小（GitHub 上限 100）。
	githubStarPageSize = 100
	// githubStarTokenCacheSeconds Installation Token 内存缓存秒数，
	// 小于 Token 实际有效期（1 小时）。
	githubStarTokenCacheSeconds = 3300
)

// maxGithubStarPages 是 Stargazers 实时分页检测的页数上限。GitHub 的
// stargazers 接口最多返回前 40000 个 Star（400 页 × 每页 100），更大的仓库
// 无法通过实时分页确认，此时返回检测异常而不是误判为「未 Star」（方案 9.5）。
const maxGithubStarPages = 400

// GithubStarCheckResult 描述一次针对 GitHub 数字用户 ID 的 Star 检测结果。
// Err 非nil 时表示检测未能完成（Token、网络、限流、5xx 等），调用方必须
// 当作「暂时无法验证」处理，不能当作「未 Star」。
type GithubStarCheckResult struct {
	Matched     bool   // 是否在 Stargazers 中匹配到该 GitHub ID
	Page        int    // 匹配到用户的页码；未匹配时为遍历到的最后一页
	StarredAt   int64  // GitHub 返回的 Star 时间（Unix 秒），0 表示未知
	GithubLogin string // 匹配到的 GitHub 登录名快照
	StatusCode  int    // 最后一次 GitHub API 响应状态码，0 表示请求未发出（网络错误）
	Err         error  // 检测失败原因
	TokenFailed bool   // Err 非 nil 时，失败是否发生在 Installation Token 获取阶段
}

// GithubStargazerItem 是 Stargazers 接口返回条目的归一化形式。
type GithubStargazerItem struct {
	GithubId    string
	GithubLogin string
	StarredAt   int64
}

// githubStargazerEntry 匹配 Accept: application/vnd.github.star+json 的响应结构。
type githubStargazerEntry struct {
	User struct {
		Id    int64  `json:"id"`
		Login string `json:"login"`
	} `json:"user"`
	StarredAt *time.Time `json:"starred_at"`
}

type githubStarInstallTokenResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

var (
	githubStarClientOnce sync.Once
	githubStarClient     *http.Client

	// githubStarTokenCache 缓存 Installation Access Token 及其本地过期时间。
	// 多节点部署下各进程各自持有缓存并独立刷新，GitHub 允许同一安装同时存在
	// 多个有效 Token，不会互相失效。
	githubStarTokenMutex    sync.Mutex
	githubStarTokenValue    string
	githubStarTokenDeadline time.Time
)

// getGithubStarHttpClient 返回带超时的 GitHub API 客户端。
func getGithubStarHttpClient() *http.Client {
	githubStarClientOnce.Do(func() {
		githubStarClient = &http.Client{
			Timeout: githubStarApiTimeout,
		}
	})
	return githubStarClient
}

// GithubStarRewardActive 判断奖励活动当前是否处于可领取状态：
// 已启用、GitHub App 凭据与仓库配置完整、奖励额度有效。
func GithubStarRewardActive() bool {
	if !common.GithubStarRewardEnabled || !common.GithubStarRewardConfigured() {
		return false
	}
	return common.GithubStarRewardQuota > 0
}

// newGithubStarAppJWT 用 App ID 与私钥生成 RS256 JWT（方案 5.1）。
// iat 提前 60 秒容忍时钟偏差；exp - iat = 600 秒，不超过 GitHub 的上限。
// 该 JWT 只用于换取 Installation Token，绝不返回前端或写入普通日志。
func newGithubStarAppJWT(now time.Time) (string, error) {
	privateKey, err := loadGithubStarPrivateKey()
	if err != nil {
		return "", err
	}
	claims := jwt.RegisteredClaims{
		Issuer:    common.GithubStarAppId,
		IssuedAt:  jwt.NewNumericDate(now.Add(-time.Minute)),
		ExpiresAt: jwt.NewNumericDate(now.Add(9 * time.Minute)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(privateKey)
}

// loadGithubStarPrivateKey 读取后台配置的 GitHub App 私钥 PEM
// （GithubStarPrivateKey，换行用字面 \n 表示）。
func loadGithubStarPrivateKey() (*rsa.PrivateKey, error) {
	normalized := strings.ReplaceAll(common.GithubStarPrivateKey, "\\n", "\n")
	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(normalized))
	if err != nil {
		return nil, fmt.Errorf("parse github app private key: %w", err)
	}
	return privateKey, nil
}

// getGithubStarInstallationToken 返回缓存的 Installation Access Token，
// 过期前自动重新生成（方案 5.2）。互斥锁覆盖整个取值+刷新过程，避免并发
// 申请时重复换取 Token。
func getGithubStarInstallationToken(ctx context.Context) (string, error) {
	githubStarTokenMutex.Lock()
	defer githubStarTokenMutex.Unlock()
	if githubStarTokenValue != "" && time.Now().Before(githubStarTokenDeadline) {
		return githubStarTokenValue, nil
	}
	token, expiresAt, err := fetchGithubStarInstallToken(ctx)
	if err != nil {
		return "", err
	}
	// 缓存截止时间取「GitHub 过期时间提前 5 分钟」与「内置缓存秒数」中较早者，
	// 保证不会使用已过期的 Token。
	deadline := time.Now().Add(githubStarTokenCacheSeconds * time.Second)
	if early := expiresAt.Add(-5 * time.Minute); early.Before(deadline) {
		deadline = early
	}
	githubStarTokenValue = token
	githubStarTokenDeadline = deadline
	return token, nil
}

// fetchGithubStarInstallToken 调用 GitHub App 接口换取 Installation Token。
func fetchGithubStarInstallToken(ctx context.Context) (string, time.Time, error) {
	appJWT, err := newGithubStarAppJWT(time.Now())
	if err != nil {
		return "", time.Time{}, err
	}
	endpoint := fmt.Sprintf("%s/app/installations/%d/access_tokens",
		githubStarApiBaseUrl, common.GithubStarInstallationId)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return "", time.Time{}, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+appJWT)
	req.Header.Set("X-GitHub-Api-Version", githubStarApiVersion)

	resp, err := getGithubStarHttpClient().Do(req)
	if err != nil {
		return "", time.Time{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		bodyStr := string(body)
		if len(bodyStr) > 500 {
			bodyStr = bodyStr[:500] + "..."
		}
		return "", time.Time{}, fmt.Errorf("github installation token status: %d, body: %s", resp.StatusCode, bodyStr)
	}
	var tokenResp githubStarInstallTokenResponse
	if err := common.DecodeJson(io.LimitReader(resp.Body, 64<<10), &tokenResp); err != nil {
		return "", time.Time{}, err
	}
	if tokenResp.Token == "" || tokenResp.ExpiresAt.IsZero() {
		return "", time.Time{}, errors.New("github installation token response missing token or expires_at")
	}
	return tokenResp.Token, tokenResp.ExpiresAt, nil
}

// fetchGithubStargazersPage 拉取一页 Stargazers（方案 5.3）。使用
// application/vnd.github.star+json 以获得 starred_at。返回条目已把数字 ID
// 归一化为十进制字符串，便于与 users.github_id 直接比较。
func fetchGithubStargazersPage(ctx context.Context, installToken string, page int) ([]GithubStargazerItem, int, error) {
	endpoint := fmt.Sprintf("%s/repos/%s/%s/stargazers?per_page=%d&page=%d",
		githubStarApiBaseUrl,
		url.PathEscape(common.GithubStarOwner),
		url.PathEscape(common.GithubStarRepo),
		githubStarPageSize, page)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "application/vnd.github.star+json")
	req.Header.Set("Authorization", "Bearer "+installToken)
	req.Header.Set("X-GitHub-Api-Version", githubStarApiVersion)
	req.Header.Set("User-Agent", "new-api")

	resp, err := getGithubStarHttpClient().Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		bodyStr := string(body)
		if len(bodyStr) > 500 {
			bodyStr = bodyStr[:500] + "..."
		}
		return nil, resp.StatusCode, fmt.Errorf("github stargazers status: %d, body: %s", resp.StatusCode, bodyStr)
	}
	var entries []githubStargazerEntry
	// 响应体限制 8MB：单页 100 条 star+json 记录远小于该值，超限视为异常响应。
	if err := common.DecodeJson(io.LimitReader(resp.Body, 8<<20), &entries); err != nil {
		return nil, resp.StatusCode, err
	}
	items := make([]GithubStargazerItem, 0, len(entries))
	for _, entry := range entries {
		starredAt := int64(0)
		if entry.StarredAt != nil {
			starredAt = entry.StarredAt.Unix()
		}
		items = append(items, GithubStargazerItem{
			GithubId:    strconv.FormatInt(entry.User.Id, 10),
			GithubLogin: entry.User.Login,
			StarredAt:   starredAt,
		})
	}
	return items, resp.StatusCode, nil
}

// CheckGithubStarByGithubId 实时分页遍历目标仓库的 Stargazers，比较
// stargazer.user.id 与指定 GitHub 数字 ID（方案 5.4）。结束条件：匹配到用户、
// 当前页返回数量小于页大小（已到末页），或达到页数上限（按检测异常处理）。
func CheckGithubStarByGithubId(ctx context.Context, githubId string) GithubStarCheckResult {
	installToken, err := getGithubStarInstallationToken(ctx)
	if err != nil {
		return GithubStarCheckResult{Err: fmt.Errorf("github installation token: %w", err), TokenFailed: true}
	}
	for page := 1; page <= maxGithubStarPages; page++ {
		items, statusCode, err := fetchGithubStargazersPage(ctx, installToken, page)
		if err != nil {
			return GithubStarCheckResult{Page: page, StatusCode: statusCode, Err: err}
		}
		for _, item := range items {
			if item.GithubId == githubId {
				return GithubStarCheckResult{
					Matched:     true,
					Page:        page,
					StarredAt:   item.StarredAt,
					GithubLogin: item.GithubLogin,
					StatusCode:  statusCode,
				}
			}
		}
		if len(items) < githubStarPageSize {
			return GithubStarCheckResult{Page: page, StatusCode: statusCode}
		}
	}
	return GithubStarCheckResult{
		Page: maxGithubStarPages,
		Err:  errors.New("github stargazers pagination limit exceeded"),
	}
}
