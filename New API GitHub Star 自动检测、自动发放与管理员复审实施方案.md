# New API GitHub Star 自动检测、自动发放与管理员复审实施方案

**文档版本：** 1.0

**适用场景：** New API 已通过 GitHub App 完成用户登录，并在用户表中保存了 GitHub 数字用户 ID（`github_id`）。用户 Star 指定仓库后，可以自行申请奖励额度。系统自动检测 Star 状态并自动发放额度，管理员随后可以复审、查询和撤销异常奖励。

---

## 1. 方案结论

系统不需要保存每个用户的 GitHub Access Token。服务端使用已安装到目标仓库的 GitHub App，生成 Installation Access Token，读取目标仓库的 Stargazers 列表，并将其中的 `user.id` 与 New API 当前用户绑定的 `github_id` 比较。

整体流程如下：

```text
用户登录 New API
    ↓
读取当前用户绑定的 github_id
    ↓
用户点击“申请 GitHub Star 奖励”
    ↓
系统检查该用户是否已经领取过本活动奖励
    ↓
GitHub App 生成或复用 Installation Access Token
    ↓
分页读取目标仓库 Stargazers
    ↓
比较 stargazer.user.id == 当前用户.github_id
    ↓
未 Star：拒绝申请并提示用户
已 Star：事务内自动发放额度
    ↓
写入奖励记录、额度日志和审计日志
    ↓
管理员后台复审申请和已发放记录
```

**自动审核**在本文中指：用户申请后由系统自动验证并自动发放，不等待人工审批。**管理员复审**指：管理员可以查看检测证据、操作日志和发放记录，并在发现异常时撤销奖励或冻结相关账号。

---

## 2. GitHub App 前置配置

### 2.1 必需配置

在 GitHub App 中完成以下配置：

| 配置项 | 要求 | 用途 |
|---|---|---|
| App ID | 必须 | 标识 GitHub App，并用于生成 App JWT |
| Private Key | 必须 | 使用 RS256 生成 App JWT |
| Installation ID | 必须 | 标识 App 安装到哪个账号或组织 |
| Repository permission: Metadata | `Read-only` | 读取仓库和用户相关元数据 |
| App 安装范围 | 包含目标仓库 | 允许 App 访问目标仓库 |
| User callback URL | 已配置 | 继续用于 GitHub 登录 |
| Post-installation Setup URL | 建议配置 | 安装完成后显示成功页面，不要与登录回调混用 |

`Enable Device Flow` 不是本功能所需配置。`Client ID` 和 `Client Secret` 主要用于 OAuth 登录流程，不能直接替代 Installation Access Token 读取仓库数据。

### 2.2 Installation ID 获取方式

安装 App 后打开：

```text
https://github.com/settings/installations
```

找到目标 App 并点击 **Configure**。页面地址通常类似：

```text
https://github.com/settings/installations/12345678
```

URL 最后的 `12345678` 就是 Installation ID。

如果 App 安装在组织下，应在对应组织的安装设置中获取 Installation ID。也可以使用 App JWT 调用以下接口获取所有安装：

```http
GET https://api.github.com/app/installations
```

返回 JSON 中的 `id` 字段就是 Installation ID。

### 2.3 权限和可访问性验证

开发完成后，使用生成的 Installation Token 请求：

```bash
curl -i \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_INSTALLATION_TOKEN" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  -H "User-Agent: new-api" \
  "https://api.github.com/repos/OWNER/REPO/stargazers?per_page=100&page=1"
```

预期结果是 `200 OK`。如果返回 `403 Resource not accessible by integration`，应检查 App 是否安装到目标仓库、权限是否已更新，以及使用的是否确实是 Installation Token。

> GitHub 对 Stargazers 列表接口可能施加访问限制。生产环境必须以实际 App 权限和接口返回结果为准，不能只依据管理页面上的权限名称判断可用性。[1]

---

## 3. 服务端配置参数

建议增加以下环境变量。变量名可以按照 New API 当前配置风格调整，但含义应保持一致。

```env
# GitHub App 身份
GITHUB_STAR_APP_ID=123456
GITHUB_STAR_INSTALLATION_ID=12345678
GITHUB_STAR_PRIVATE_KEY_PATH=/data/github-app/private-key.pem

# 目标仓库
GITHUB_STAR_OWNER=OWNER
GITHUB_STAR_REPO=REPO
GITHUB_STAR_REPOSITORY_URL=https://github.com/OWNER/REPO

# 奖励策略
GITHUB_STAR_REWARD_ENABLED=true
GITHUB_STAR_REWARD_CAMPAIGN=github-star-2026
GITHUB_STAR_REWARD_QUOTA=1000000
GITHUB_STAR_REWARD_ONCE=true

# GitHub API
GITHUB_API_BASE_URL=https://api.github.com
GITHUB_API_TIMEOUT_SECONDS=10
GITHUB_STAR_PAGE_SIZE=100
GITHUB_STAR_TOKEN_CACHE_SECONDS=3300

# 申请频率限制
GITHUB_STAR_CLAIM_RATE_LIMIT=5
GITHUB_STAR_CLAIM_RATE_WINDOW_SECONDS=60
```

如果不使用私钥文件，也可以使用环境变量保存私钥：

```env
GITHUB_STAR_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

推荐使用挂载文件或密钥管理服务。Private Key、App JWT 和 Installation Token 不得返回前端，不得写入普通日志，不得提交到 Git 仓库。

| 参数 | 说明 |
|---|---|
| `GITHUB_STAR_APP_ID` | GitHub App 的数字 ID |
| `GITHUB_STAR_INSTALLATION_ID` | App 安装实例的 ID |
| `GITHUB_STAR_PRIVATE_KEY_PATH` | App 私钥文件路径 |
| `GITHUB_STAR_OWNER` | 目标仓库所有者 |
| `GITHUB_STAR_REPO` | 目标仓库名 |
| `GITHUB_STAR_REWARD_CAMPAIGN` | 奖励活动标识，用于支持未来多活动 |
| `GITHUB_STAR_REWARD_QUOTA` | 发放额度，必须按照 New API 当前 quota 单位填写 |
| `GITHUB_STAR_TOKEN_CACHE_SECONDS` | Installation Token 缓存时间，应小于 Token 实际过期时间 |
| `GITHUB_STAR_CLAIM_RATE_LIMIT` | 单个来源在时间窗口内允许的最大申请次数 |

---

## 4. 数据库设计

以下 DDL 以 MySQL 为例。字段类型应按照 New API 当前数据库版本和既有命名规范调整。执行前应先确认用户表、额度日志表和数据库字符集。

### 4.1 活动配置表

如果只做一个固定活动，可以把仓库和额度放在环境变量中。如果希望管理员后台修改仓库、额度或启停状态，建议创建活动表：

```sql
CREATE TABLE github_star_campaigns (
    id BIGINT NOT NULL AUTO_INCREMENT,
    campaign_key VARCHAR(64) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    repo VARCHAR(255) NOT NULL,
    repository_url VARCHAR(512) NOT NULL,
    reward_quota BIGINT NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    claim_once TINYINT(1) NOT NULL DEFAULT 1,
    start_at DATETIME NULL,
    end_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_github_star_campaign_key (campaign_key),
    KEY idx_github_star_campaign_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

示例数据：

```sql
INSERT INTO github_star_campaigns
(
    campaign_key,
    owner,
    repo,
    repository_url,
    reward_quota,
    enabled,
    claim_once,
    created_at,
    updated_at
)
VALUES
(
    'github-star-2026',
    'OWNER',
    'REPO',
    'https://github.com/OWNER/REPO',
    1000000,
    1,
    1,
    NOW(),
    NOW()
);
```

### 4.2 奖励领取记录表

该表是防重复发放的核心。`github_id + campaign_id` 和 `user_id + campaign_id` 都应保持唯一。

```sql
CREATE TABLE github_star_reward_claims (
    id BIGINT NOT NULL AUTO_INCREMENT,
    campaign_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    github_id BIGINT NOT NULL,
    github_login VARCHAR(255) NULL,
    reward_quota BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'granted',
    verification_method VARCHAR(32) NOT NULL DEFAULT 'github_app',
    stargazer_page INT NULL,
    starred_at DATETIME NULL,
    github_checked_at DATETIME NOT NULL,
    granted_at DATETIME NULL,
    revoked_at DATETIME NULL,
    revoked_by BIGINT NULL,
    revoke_reason VARCHAR(512) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_github_star_claim_github_campaign (github_id, campaign_id),
    UNIQUE KEY uk_github_star_claim_user_campaign (user_id, campaign_id),
    KEY idx_github_star_claim_status (status),
    KEY idx_github_star_claim_created_at (created_at),
    KEY idx_github_star_claim_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

推荐状态值如下：

| 状态 | 含义 |
|---|---|
| `checking` | 正在检测，适用于异步实现 |
| `granted` | 已自动验证并发放额度 |
| `rejected_not_starred` | 检测时未发现 Star |
| `rejected_token` | GitHub App Token 无效或不可用 |
| `rejected_error` | GitHub API 或系统异常，未发放额度 |
| `revoked` | 管理员复审后撤销奖励 |

### 4.3 Stargazers 本地缓存表

仓库 Star 数量较多时，建议定时同步 Stargazers，申请接口优先查询本地缓存。该表不是防重复发放的依据，最终唯一约束仍以领取记录表为准。

```sql
CREATE TABLE github_stargazers (
    campaign_id BIGINT NOT NULL,
    github_id BIGINT NOT NULL,
    github_login VARCHAR(255) NULL,
    starred_at DATETIME NULL,
    first_seen_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    PRIMARY KEY (campaign_id, github_id),
    KEY idx_github_stargazers_last_seen (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.4 检测与审计日志表

管理员复审需要知道系统当时向 GitHub 请求了什么、返回了什么结果，以及是谁进行了后续操作。日志中只保存请求元数据，禁止保存 Token 和 Private Key。

```sql
CREATE TABLE github_star_audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    claim_id BIGINT NULL,
    campaign_id BIGINT NULL,
    user_id BIGINT NULL,
    github_id BIGINT NULL,
    action VARCHAR(64) NOT NULL,
    result VARCHAR(64) NOT NULL,
    github_status_code INT NULL,
    github_page INT NULL,
    matched TINYINT(1) NULL,
    operator_id BIGINT NULL,
    detail VARCHAR(1024) NULL,
    request_id VARCHAR(128) NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_github_star_audit_claim_id (claim_id),
    KEY idx_github_star_audit_github_id (github_id),
    KEY idx_github_star_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.5 与 New API 额度日志的关系

发放成功时必须复用 New API 现有的额度变更逻辑和额度日志表，不要自行修改用户额度后跳过原有日志。奖励领取记录表保存奖励业务状态，New API 额度日志表保存实际余额变化，二者应通过业务 ID 或备注关联。

---

## 5. GitHub API 实现过程

### 5.1 生成 App JWT

服务端使用 App ID 和 Private Key 生成 RS256 JWT。JWT 的 `iat` 应略早于当前时间，`exp` 不得超过 GitHub 允许的有效期上限。JWT 只用于 App 级别接口，例如获取安装信息或换取 Installation Token。

### 5.2 获取 Installation Access Token

调用：

```http
POST https://api.github.com/app/installations/{installation_id}/access_tokens
```

请求头：

```http
Accept: application/vnd.github+json
Authorization: Bearer APP_JWT
X-GitHub-Api-Version: 2026-03-10
```

返回结果中的 `token` 是短期 Installation Access Token。服务端应缓存 Token 和过期时间，并在过期前重新生成。缓存键建议包含 Installation ID：

```text
github-app-installation-token:{installation_id}
```

### 5.3 分页读取 Stargazers

调用：

```http
GET https://api.github.com/repos/{owner}/{repo}/stargazers?per_page=100&page={page}
```

请求头：

```http
Accept: application/vnd.github.star+json
Authorization: Bearer INSTALLATION_TOKEN
X-GitHub-Api-Version: 2026-03-10
User-Agent: new-api
```

`application/vnd.github.star+json` 用于让返回结果包含 `starred_at`。本功能主要比较 `user.id`，时间字段用于管理员复审和审计展示。

核心判断逻辑是：

```text
当前 New API 用户的 github_id
    ==
GitHub Stargazer 返回对象中的 user.id
```

分页结束条件是：

```text
找到匹配用户；或者
当前页返回数量小于 page_size；或者
返回空数组。
```

如果接口返回 `401`、`403` 或非预期状态码，不能把它当成“用户未 Star”。应记录失败状态，并提示用户稍后重试，避免因 GitHub 权限问题误拒绝或误发放。

### 5.4 Go 伪代码

```go
func CheckStarByGithubID(
    ctx context.Context,
    token string,
    owner string,
    repo string,
    githubID int64,
) (matched bool, page int, starredAt *time.Time, err error) {
    const pageSize = 100

    for page = 1; ; page++ {
        url := fmt.Sprintf(
            "https://api.github.com/repos/%s/%s/stargazers?per_page=%d&page=%d",
            url.PathEscape(owner),
            url.PathEscape(repo),
            pageSize,
            page,
        )

        req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
        if err != nil {
            return false, page, nil, err
        }

        req.Header.Set("Accept", "application/vnd.github.star+json")
        req.Header.Set("Authorization", "Bearer "+token)
        req.Header.Set("X-GitHub-Api-Version", "2026-03-10")
        req.Header.Set("User-Agent", "new-api")

        resp, err := http.DefaultClient.Do(req)
        if err != nil {
            return false, page, nil, err
        }

        if resp.StatusCode != http.StatusOK {
            resp.Body.Close()
            return false, page, nil, fmt.Errorf("github status: %d", resp.StatusCode)
        }

        var items []struct {
            User struct {
                ID int64 `json:"id"`
                Login string `json:"login"`
            } `json:"user"`
            StarredAt *time.Time `json:"starred_at"`
        }

        err = json.NewDecoder(resp.Body).Decode(&items)
        resp.Body.Close()
        if err != nil {
            return false, page, nil, err
        }

        for _, item := range items {
            if item.User.ID == githubID {
                return true, page, item.StarredAt, nil
            }
        }

        if len(items) < pageSize {
            return false, page, nil, nil
        }
    }
}
```

生产代码还应增加连接超时、响应体大小限制、GitHub 限流处理、结构化日志和请求 ID 传递。

---

## 6. 自动申请和自动发放接口

建议新增用户接口：

```http
POST /api/user/github-star-reward/claim
```

接口不接受前端传入 `github_id`。服务端必须从当前登录用户对应的数据库记录中读取 `github_id`。

### 6.1 请求流程

```text
1. 检查奖励活动是否启用及是否在有效期内。
2. 检查当前用户是否已登录并已绑定 github_id。
3. 检查当前用户和 github_id 是否已有已发放记录。
4. 按频率限制规则限制重复请求。
5. 获取或生成 Installation Token。
6. 查询 Stargazers 并比较 GitHub ID。
7. 未匹配时写入拒绝审计记录并返回提示。
8. 匹配时开启数据库事务。
9. 在事务中再次检查唯一领取资格。
10. 增加 New API quota。
11. 写入 New API 额度日志。
12. 写入 github_star_reward_claims。
13. 写入成功审计日志并提交事务。
```

### 6.2 返回示例

已 Star 并成功发放：

```json
{
  "success": true,
  "status": "granted",
  "message": "Star 验证成功，额度已自动发放",
  "quota": 1000000
}
```

未 Star：

```json
{
  "success": false,
  "status": "rejected_not_starred",
  "message": "未检测到你的 GitHub 账号已 Star 指定仓库",
  "repository_url": "https://github.com/OWNER/REPO"
}
```

已领取：

```json
{
  "success": false,
  "status": "already_claimed",
  "message": "该 GitHub 账号已经领取过本活动奖励"
}
```

GitHub 检测异常：

```json
{
  "success": false,
  "status": "verification_unavailable",
  "message": "暂时无法完成 GitHub 验证，请稍后重试"
}
```

---

## 7. 事务和并发控制

额度发放必须与奖励记录、额度日志放在同一个数据库事务中。推荐执行顺序如下：

```sql
START TRANSACTION;

-- 先抢占唯一领取资格。github_id + campaign_id 和 user_id + campaign_id
-- 的唯一索引负责阻止并发重复领取。
INSERT INTO github_star_reward_claims
(
    campaign_id,
    user_id,
    github_id,
    github_login,
    reward_quota,
    status,
    verification_method,
    github_checked_at,
    granted_at,
    created_at,
    updated_at
)
VALUES
(?, ?, ?, ?, ?, 'granted', 'github_app', ?, NOW(), NOW(), NOW());

-- 调用 New API 既有的额度增加逻辑，或执行等价的加法更新。
UPDATE users
SET quota = quota + ?
WHERE id = ?;

-- 写入 New API 既有额度日志，备注中包含 campaign 和 claim_id。
INSERT INTO quota_logs (...)
VALUES (...);

COMMIT;
```

如果插入领取记录时发生唯一键冲突，应回滚事务并返回“已经领取过”，不能继续增加额度。

如果采用 `checking` 状态并异步执行，必须增加超时恢复机制。处理进程异常退出后，应允许管理员或后台任务把长期停留在 `checking` 的记录标记为 `rejected_error`，避免奖励资格永久锁死。

---

## 8. 管理员复审功能

虽然系统自动发放，仍建议提供管理员复审页面和接口。

### 8.1 管理员列表

建议接口：

```http
GET /api/admin/github-star-reward/claims
```

支持以下筛选条件：

| 筛选条件 | 说明 |
|---|---|
| `campaign_id` | 指定活动 |
| `status` | `granted`、`rejected`、`revoked` |
| `user_id` | New API 用户 ID |
| `github_id` | GitHub 数字用户 ID |
| 时间范围 | 申请时间或发放时间 |

列表至少展示：

```text
New API 用户 ID
GitHub ID
GitHub 登录名快照
仓库地址
检测时间
检测结果
检测页码
发放额度
发放时间
请求 ID
```

### 8.2 管理员重新检测

建议接口：

```http
POST /api/admin/github-star-reward/claims/{id}/recheck
```

重新检测时重新读取当前 Stargazers。检测结果只用于复审，不应直接绕过权限校验或修改原始审计记录。

管理员复审不能仅因为用户当前已经取消 Star 就伪造“申请时未 Star”。应保留原始检测结果，同时在复审时记录当前状态：

```text
申请时检测：已 Star
当前复审检测：未 Star
处理结果：管理员决定是否撤销奖励
```

### 8.3 管理员撤销奖励

建议接口：

```http
POST /api/admin/github-star-reward/claims/{id}/revoke
```

撤销时必须：

1. 检查记录当前状态为 `granted`。
2. 使用事务扣除已发放额度，或调用 New API 既有的额度调整逻辑。
3. 写入额度调整日志。
4. 将记录更新为 `revoked`。
5. 保存管理员 ID、撤销原因和时间。
6. 写入审计日志。

撤销操作可能影响用户余额，属于高风险管理操作。管理员接口必须进行权限校验、CSRF 防护或等效请求来源校验，并保留审计记录。

---

## 9. 防刷和一致性要求

### 9.1 身份绑定

前端不能提交任意 `github_id`。服务端必须使用当前登录用户绑定的 GitHub ID。GitHub 数字 ID 应作为主要身份键，GitHub 用户名只保存为展示快照。

### 9.2 一次领取

至少建立以下两个唯一约束：

```text
(github_id, campaign_id)
(user_id, campaign_id)
```

这样可以防止同一 GitHub 账号绑定多个 New API 账号重复领取，也可以防止同一个站内账号重复提交。

### 9.3 请求限流

建议对以下维度同时限流：

```text
用户 ID
GitHub ID
IP 地址
```

限流只能减少滥用，不能替代数据库唯一约束。

### 9.4 GitHub API 限流

不要在前端轮询 Star 状态。申请时检查一次即可。若仓库 Star 数量较大，使用定时同步表降低 API 请求量。同步缓存可以提高性能，但最终发放仍必须由数据库唯一约束保证幂等。

### 9.5 失败处理

GitHub API 超时、401、403、429 或 5xx 时，不得当作“未 Star”。应返回稍后重试，并记录错误状态。只有明确查询成功且遍历完成后未找到匹配 ID，才能写入 `rejected_not_starred`。

---

## 10. 可选的 Stargazers 定时同步

当仓库 Stargazers 数量较大时，建议增加后台任务，每 5 至 10 分钟同步一次：

```text
读取活动配置
    ↓
获取 Installation Token
    ↓
从第 1 页开始读取 Stargazers
    ↓
批量写入或更新 github_stargazers
    ↓
直到返回数量小于 page_size
    ↓
记录同步时间、页数和错误信息
```

申请流程可以先查本地表。如果本地没有匹配记录，可以再进行一次实时查询，以减少新增 Star 尚未同步时的误判。同步任务不能删除本地记录后直接撤销奖励，因为用户取消 Star 之后是否撤销奖励应由活动策略和管理员复审决定。

---

## 11. 测试验收清单

### GitHub App 验收

- [ ] App 已安装到目标仓库。
- [ ] `Metadata` 权限为 `Read-only`。
- [ ] App ID、Private Key、Installation ID 均可由服务端读取。
- [ ] 服务端可以生成 App JWT。
- [ ] 服务端可以换取 Installation Token。
- [ ] Installation Token 请求 Stargazers 返回 `200`。
- [ ] 返回对象包含 `user.id`。

### 用户流程验收

- [ ] 未绑定 GitHub 的用户不能领取。
- [ ] 未 Star 的用户不会获得额度。
- [ ] 已 Star 的用户可以自动领取。
- [ ] 领取成功后用户余额和额度日志都正确。
- [ ] 同一用户重复点击不会重复发放。
- [ ] 同一 GitHub ID 绑定多个 New API 用户时不能重复领取。
- [ ] GitHub API 失败时不会误发放或误标记为未 Star。

### 管理员流程验收

- [ ] 管理员可以按活动、状态、用户和 GitHub ID查询。
- [ ] 管理员可以查看原始检测时间和检测结果。
- [ ] 管理员可以重新检测。
- [ ] 管理员可以撤销奖励。
- [ ] 撤销会产生额度调整日志。
- [ ] 撤销会产生管理员审计日志。

### 安全验收

- [ ] Private Key、App JWT 和 Installation Token 不出现在前端。
- [ ] 敏感凭据不写入普通日志。
- [ ] 领取接口不接受客户端提交的 GitHub ID 作为可信参数。
- [ ] 领取记录有数据库唯一约束。
- [ ] 额度增加和领取记录写入使用同一事务。
- [ ] 管理员接口有权限校验和请求防护。

---

## 12. 部署顺序

建议按以下顺序上线：

1. 在测试仓库配置并安装 GitHub App。
2. 在测试环境配置 App ID、Private Key 和 Installation ID。
3. 完成 Token 生成和 Stargazers 查询接口。
4. 创建活动表、领取记录表和审计表。
5. 接入 New API 现有用户表和额度日志逻辑。
6. 先上线只检测不发放的灰度模式。
7. 使用测试账号验证已 Star、未 Star、重复点击和并发请求。
8. 打开小额度自动发放。
9. 验证管理员复审、重新检测和撤销流程。
10. 最后切换正式仓库和正式奖励额度。

建议增加一个灰度配置：

```env
GITHUB_STAR_REWARD_DRY_RUN=true
```

灰度模式下照常执行 GitHub 检测和审计，但不修改用户额度。确认日志、权限和查询结果正确后，再设置为：

```env
GITHUB_STAR_REWARD_DRY_RUN=false
```

---

## 13. 参考资料

[1]: https://docs.github.com/en/rest/activity/starring "GitHub REST API endpoints for starring"
[2]: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app "Authenticating with a GitHub App"
[3]: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app "Generating a JSON Web Token for a GitHub App"
[4]: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app "Generating an installation access token for a GitHub App"
[5]: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/installing-a-github-app-on-your-personal-account "Installing a GitHub App on your personal account"

---

**文档作者：** Manus AI

**实施提示：** 本文给出的是独立功能的实现方案。真正修改 New API 时，应优先复用当前版本已有的用户认证、中间件、额度调整、事务、日志、路由和管理员权限实现，避免重复创建同类基础设施。

---

## 13. 变更补记：发放改为管理员审批制（2026-09-12）

原方案为「系统自动检测通过后立即发放额度，管理员事后复审」。本文档实施后按站方要求调整为**真实审批流**：检测通过只落待审批记录，管理员批准后额度才到账。

### 13.1 状态机调整

领取记录 `status` 由 `granted / revoked` 两态扩展为四态：

| 状态 | 含义 | 额度影响 |
| --- | --- | --- |
| `pending` | 系统检测通过，待管理员审批 | 不动额度 |
| `granted` | 管理员已批准 | 批准时事务内加额度 |
| `rejected` | 管理员拒绝申请 | 不动额度（从未发放） |
| `revoked` | 管理员撤销已发放奖励 | 撤销时扣回额度 |

- 拒绝的决策时间 / 操作人 / 原因**复用** `revoked_at` / `revoked_by` / `revoke_reason` 三列（拒绝与撤销同为管理员否定决定），无 schema 变更。
- `approve` 允许作用于 `pending` 与 `rejected`（后者是管理员反悔的唯一补救路径，唯一约束保证不会重复发放）；`reject` 仅作用于 `pending`；`revoke` 仅作用于 `granted`。
- 检测失败（未 Star / Token 异常 / API 异常）仍不落领取记录，用户可重试，与本节审批流无关。
- 灰度模式（dry run）语义不变：照常检测与审计，不落记录、不发额度。

### 13.2 流程与接口调整

1. `POST /api/github-star-reward/claim`：检测通过后落 `pending` 记录，响应 `{status:"pending", quota:0}`；申请审计 result 由 `granted` 改为 `submitted`。
2. 新增 `POST /api/github-star-reward/admin/claims/{id}/approve`：事务内 `pending/rejected → granted` 并条件加额度（保留 MaxQuota 上限守卫），写审批审计与管理操作审计。
3. 新增 `POST /api/github-star-reward/admin/claims/{id}/reject`（body 含必填 `reason`）：`pending → rejected`，不动额度。
4. 原有 `recheck` / `revoke` 接口语义不变。

### 13.3 前端展示

- 福利空投页奖励弹窗：已提交申请的用户看到**四阶段审核进度图**——用户申请领取 → 系统审核 → 管理员审核 → 额度到账，各阶段由领取记录的 `status` 与时间戳推导；拒绝 / 撤销在对应阶段就地标注原因。
- 管理端领取记录页：状态筛选与徽章支持 `pending`（待管理员审核）/ `rejected`（已拒绝）；行操作新增「批准」「拒绝」（拒绝需填原因）。

### 13.4 被拒申请的重新申请（2026-09-13 补记）

被拒绝（rejected）的申请允许用户重新提交，其余状态（pending 审核中 / granted 已发放 / revoked 已撤销）仍锁定：

- 前端：进度页在记录为 rejected 时显示「重新申请」按钮；点击弹出确认框，提醒用户确认已 Star 目标仓库、刚点亮 Star 需等待检测同步后再试。
- 后端：`CreatePendingGithubStarRewardClaim` 在同一事务内先删除同活动同用户/GitHub 账号的 rejected 旧记录，再插入新的 pending 记录（拒绝痕迹保留在审计日志）；重复提交的报错按状态区分——审核中提示「正在审核，请勿重复提交」，已发放/已撤销提示「已领取过」。
- 检测未通过时不会删除旧记录：重新申请与首次申请共用同一检测流程，检测失败（未 Star / GitHub 异常）直接返回，rejected 旧记录保持不变。
