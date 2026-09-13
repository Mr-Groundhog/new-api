package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// insertGithubStarClaimUser 创建一个带初始额度的用户并返回，额度不变式断言
// 都基于该初始值。
func insertGithubStarClaimUser(t *testing.T, username string, quota int) *User {
	t.Helper()
	user := &User{Username: username, Password: "password", AffCode: username, Quota: quota}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func githubStarTestClaim(userId int, githubId string) *GithubStarRewardClaim {
	return &GithubStarRewardClaim{
		CampaignKey:     "github-star",
		UserId:          userId,
		GithubId:        githubId,
		GithubLogin:     "octocat-" + githubId,
		Repository:      "owner/repo",
		RewardQuota:     500000,
		GithubCheckedAt: 1700000000,
	}
}

func TestGithubStarClaimApprovalGrantsQuotaExactlyOnce(t *testing.T) {
	truncateTables(t)

	user := insertGithubStarClaimUser(t, "github_star_approve", 1000)
	claim := githubStarTestClaim(user.Id, "12345678")
	require.NoError(t, CreatePendingGithubStarRewardClaim(claim))

	// 申请落库后为待审批状态，不动用户额度
	assert.Equal(t, GithubStarClaimStatusPending, claim.Status)
	assert.Zero(t, claim.GrantedAt)
	var after User
	require.NoError(t, DB.First(&after, "id = ?", user.Id).Error)
	assert.Equal(t, 1000, after.Quota)

	// 并发重复申请撞唯一约束，不给二次提交机会
	duplicate := githubStarTestClaim(user.Id, "12345678")
	assert.ErrorIs(t, CreatePendingGithubStarRewardClaim(duplicate), ErrGithubStarClaimAlreadyTaken)

	// 批准后额度精确到账一次
	approved, err := ApproveGithubStarRewardClaim(claim.Id, 99)
	require.NoError(t, err)
	assert.Equal(t, GithubStarClaimStatusGranted, approved.Status)
	assert.NotZero(t, approved.GrantedAt)
	require.NoError(t, DB.First(&after, "id = ?", user.Id).Error)
	assert.Equal(t, 1000+500000, after.Quota)

	// 重复批准 / 对已发放记录拒绝均无副作用，额度不变
	_, err = ApproveGithubStarRewardClaim(claim.Id, 99)
	assert.ErrorIs(t, err, ErrGithubStarClaimNotPending)
	_, err = RejectGithubStarRewardClaim(claim.Id, 99, "late")
	assert.ErrorIs(t, err, ErrGithubStarClaimNotPending)
	require.NoError(t, DB.First(&after, "id = ?", user.Id).Error)
	assert.Equal(t, 1000+500000, after.Quota)
}

func TestGithubStarClaimRejectionLeavesQuotaUntouched(t *testing.T) {
	truncateTables(t)

	user := insertGithubStarClaimUser(t, "github_star_reject", 1000)
	claim := githubStarTestClaim(user.Id, "87654321")
	require.NoError(t, CreatePendingGithubStarRewardClaim(claim))

	rejected, err := RejectGithubStarRewardClaim(claim.Id, 7, "suspicious star")
	require.NoError(t, err)
	assert.Equal(t, GithubStarClaimStatusRejected, rejected.Status)
	assert.Equal(t, 7, rejected.RevokedBy)
	assert.Equal(t, "suspicious star", rejected.RevokeReason)
	assert.NotZero(t, rejected.RevokedAt)
	assert.Zero(t, rejected.GrantedAt)

	var after User
	require.NoError(t, DB.First(&after, "id = ?", user.Id).Error)
	assert.Equal(t, 1000, after.Quota)

	// 重复拒绝无副作用
	_, err = RejectGithubStarRewardClaim(claim.Id, 7, "again")
	assert.ErrorIs(t, err, ErrGithubStarClaimNotPending)

	// 管理员反悔：拒绝后仍可批准，额度此时才到账
	approved, err := ApproveGithubStarRewardClaim(claim.Id, 7)
	require.NoError(t, err)
	assert.Equal(t, GithubStarClaimStatusGranted, approved.Status)
	require.NoError(t, DB.First(&after, "id = ?", user.Id).Error)
	assert.Equal(t, 1000+500000, after.Quota)
}

func TestGithubStarClaimRejectedAllowsResubmission(t *testing.T) {
	truncateTables(t)

	user := insertGithubStarClaimUser(t, "github_star_resubmit", 1000)
	claim := githubStarTestClaim(user.Id, "13579246")
	require.NoError(t, CreatePendingGithubStarRewardClaim(claim))
	_, err := RejectGithubStarRewardClaim(claim.Id, 7, "not detected yet")
	require.NoError(t, err)

	// 被拒后重新申请：旧 rejected 记录被替换为新的 pending 记录
	resubmit := githubStarTestClaim(user.Id, "13579246")
	require.NoError(t, CreatePendingGithubStarRewardClaim(resubmit))
	var count int64
	require.NoError(t, DB.Model(&GithubStarRewardClaim{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
	current, err := GetGithubStarRewardClaimByUserOrGithub("github-star", user.Id, "13579246")
	require.NoError(t, err)
	require.NotNil(t, current)
	assert.Equal(t, GithubStarClaimStatusPending, current.Status)
	assert.NotEqual(t, claim.Id, current.Id)

	// 审核中（pending）不允许再次提交
	err = CreatePendingGithubStarRewardClaim(githubStarTestClaim(user.Id, "13579246"))
	assert.ErrorIs(t, err, ErrGithubStarClaimAlreadyTaken)

	// 已发放（granted）同样锁死，不能通过重新申请绕过唯一约束
	_, err = ApproveGithubStarRewardClaim(current.Id, 7)
	require.NoError(t, err)
	err = CreatePendingGithubStarRewardClaim(githubStarTestClaim(user.Id, "13579246"))
	assert.ErrorIs(t, err, ErrGithubStarClaimAlreadyTaken)

	var after User
	require.NoError(t, DB.First(&after, "id = ?", user.Id).Error)
	assert.Equal(t, 1000+500000, after.Quota)
}
