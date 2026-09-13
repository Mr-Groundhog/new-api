# GitHub Star 奖励改为真实审批流 + 弹窗四阶段审核进度图

## 流程变化

现状：系统检测通过 → **立即发放额度**（granted），管理员只能事后复审/撤销。
新流程：用户申请 → 系统自动检测 Star → 通过后落 **pending** 记录（不发额度）→ 管理员在后台**批准**（granted + 发额度）/ **拒绝**（rejected）→ 弹窗进度图实时展示四个阶段：用户申请领取 → 系统审核 → 管理员审核 → 额度到账。

关键决策：
- **无 schema 变更**：status 列已是 varchar(32)，新增 `pending`/`rejected` 两个状态值；拒绝的元数据（时间/操作人/原因）**复用** `revoked_at`/`revoked_by`/`revoke_reason` 三列（拒绝与撤销同属管理员否定决定，避免三库迁移验证）。已有 granted/revoked 记录不受影响。
- **拒绝为终局，但管理员可反悔**：approve 允许作用于 `pending` 和 `rejected` 记录（唯一约束防重复领取，这是唯一的补救路径）；reject 仅作用于 `pending`。
- 灰度模式（dry run）不变：仍不落记录、不发额度。

## 后端

### 1. `model/github_star.go`
- 新增状态常量 `GithubStarClaimStatusPending = "pending"`、`GithubStarClaimStatusRejected = "rejected"`；更新结构体与状态列的注释（列注释规则）。
- 新增审计常量：action `approve`/`reject`；result `submitted`（申请通过系统检测）、`approved`、`rejected_by_admin`。
- 新增错误 `ErrGithubStarClaimNotPending`。
- `CreateGithubStarRewardClaim`（即领即得版）替换为：
  - `CreatePendingGithubStarRewardClaim`：只插入记录（status=pending，GrantedAt=0），保留唯一约束竞态处理；
  - `ApproveGithubStarRewardClaim(id, operatorId)`：事务内条件更新 `status IN ('pending','rejected') → granted` + 条件加额度（保留 MaxQuapot 上限守卫），提交后同步额度缓存 + RecordLog(LogTypeTopup)；
  - `RejectGithubStarRewardClaim(id, operatorId, reason)`：条件更新 `pending → rejected`，写 revoked_*/revoke_reason，不动额度，RecordLog(LogTypeSystem) 通知用户。
- 管理端列表筛选（status）已支持任意字符串，无需改动。

### 2. `controller/github_star.go`
- `ClaimGithubStarReward`：检测通过且非 dry-run 时落 **pending** 记录，审计 result 改为 `submitted`，响应 `{status:"pending", quota:0, repository_url}`。
- 新增 `ApproveGithubStarRewardClaim`、`RejectGithubStarRewardClaim` 处理器（拒绝需 reason，模式照抄现有 revoke），各自写审计日志 + `recordManageAuditFor`（action `github_star.approve` / `github_star.reject`）。

### 3. `router/api-router.go`
- 管理组新增 `POST /claims/:id/approve`、`POST /claims/:id/reject`。

### 4. 测试（遵循 testify + 单文件原则）
- `model/task_cas_test.go` 的共享 `TestMain` AutoMigrate 列表加入三个 github star 表。
- 新增一个 `model/github_star_test.go`：审批生命周期回归（pending 创建不占额度 → approve 精确加一次额度且不可重复批准 → reject 不动额度且不可再拒 → 唯一约束防重复申请）。

## 前端（`web/src/features/github-star-reward/`）

### 5. 类型与常量
- `types.ts`：`GithubStarClaimStatus` 增加 `'pending' | 'rejected'`；`GithubStarClaimResult.status` 细化。
- `constants.ts`：`GITHUB_STAR_CLAIM_STATUSES` 补两个状态（管理页 zod 筛选自动生效）；状态/审计标签补全。

### 6. 新组件 `review-progress.tsx`（feature 内，不进 components/ui）
竖向四阶段进度图，由 claim 记录推导：
- ① 用户申请领取：恒为完成（created_time）
- ② 系统审核：恒为完成（github_checked_at）
- ③ 管理员审核：pending → 进行中（琥珀脉冲）；granted/revoked → 完成；rejected → 失败（红 ✕ + 原因）
- ④ 额度到账：granted → 完成（granted_at）；revoked → 标注「已发放后被撤销，额度已扣除」；rejected → 阻断
图标用 lucide（ClipboardCheck / ShieldCheck / UserCog / Wallet），时间戳用现有 formatTimestampToDate。

### 7. `reward-card.tsx`
存在 claim 记录时用 `ReviewProgress` 替换现有 `RewardClaimRecord` 区块（仓库/额度卡片保留；未绑定 GitHub 的提示不变）。

### 8. `github-star-reward-entry.tsx`
mutation onSuccess 处理 `status === 'pending'` → toast「申请已提交，等待管理员审核」+ 刷新 status 查询；dry_run / granted 分支保留。

### 9. 管理端
- `api.ts` 新增 `approveGithubStarRewardClaim(id)`、`rejectGithubStarRewardClaim(id, reason)`。
- `admin-claims-row-actions.tsx`：pending/rejected 显示「批准」（确认框展示将发放额度）；pending 显示「拒绝」（原因输入框，照抄 revoke 弹窗）。
- `admin-claims-columns.tsx`：状态徽章 pending=warning、rejected=danger，rejected/revoked 在徽章下展示原因。

### 10. i18n
en.json / zh.json 新增约 18 个键（Pending review、Rejected、Approve、Reject、User claimed、System verification、Admin review、Quota credited、申请已提交…、批准/拒绝确认文案、审计标签等），constants 引用的键同步登记 `static-keys.ts`。

## 验证

- 后端：`go build ./...`、`gofmt`、`go test ./model -run GithubStar`。
- 前端：`web/` 下 `bun run build`（含类型检查），必要时 `bun run i18n:sync` 校对键。
- 数据库：无 schema 变更（仅新状态值 + 复用列），不需要三库迁移矩阵；现有数据向后兼容。
- 实施方案文档（根目录 md）追加一节说明审批流变更。