package service

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/risk_setting"
)

func newRiskTestDB(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/risk.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.TokenRiskEvent{}))
	model.DB = db
	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			_ = sqlDB.Close()
		}
		model.DB = previousDB
	})
}

func TestComputeClientFingerprintIsStableAndSaltSensitive(t *testing.T) {
	headers := func(name string) string {
		switch name {
		case "User-Agent":
			return "claude-cli/1.0.34"
		case "Accept":
			return "application/json"
		default:
			return ""
		}
	}

	fp1 := ComputeClientFingerprint(headers, "salt-a")
	fp2 := ComputeClientFingerprint(headers, "salt-a")
	assert.Equal(t, fp1, fp2, "same headers and salt must produce the same fingerprint")
	assert.Len(t, fp1, 16)

	fpOther := ComputeClientFingerprint(headers, "salt-b")
	assert.NotEqual(t, fp1, fpOther, "different salt must change the fingerprint")

	fpNoSalt := ComputeClientFingerprint(headers, "")
	assert.Empty(t, fpNoSalt, "empty salt disables fingerprinting")

	missing := func(string) string { return "" }
	fpMissing := ComputeClientFingerprint(missing, "salt-a")
	assert.NotEmpty(t, fpMissing, "missing headers still hash via placeholders")
	assert.NotEqual(t, fp1, fpMissing)
}

func TestMemoryRiskInflightTrackerConcurrencySignals(t *testing.T) {
	tracker := &memoryRiskInflightTracker{}
	tokenId := 101

	// 同一客户端（同指纹）8 个并发（子代理场景）：单一指纹计数高，指纹数为 1。
	for range 8 {
		tracker.Enter(tokenId, "fp-same")
	}
	// 离开一个后单指纹在途 7，远低于单指纹并发阈值（默认 20），无事件。
	assert.Nil(t, tracker.Leave(tokenId, "fp-same"))

	// 第二、三个不同指纹加入后：三个指纹各有 2 个在途请求。此时离开一个，
	// 指纹桶数仍为 3（达到阈值），产生 concurrent_fp 事件。
	for range 2 {
		tracker.Enter(tokenId, "fp-b")
	}
	for range 2 {
		tracker.Enter(tokenId, "fp-c")
	}
	event := tracker.Leave(tokenId, "fp-c")
	require.NotNil(t, event, "3 distinct in-flight fingerprints must trigger concurrent_fp")
	assert.Equal(t, risk_setting.RiskEventConcurrentFp, event.EventType)

	// 清空全部在途计数。
	for range 7 {
		tracker.Leave(tokenId, "fp-same")
	}
	tracker.Leave(tokenId, "fp-b")
	tracker.Leave(tokenId, "fp-c")
	assert.Nil(t, tracker.Leave(tokenId, "fp-same"))
}

func TestRecordTokenRiskEventHourlyDedup(t *testing.T) {
	newRiskTestDB(t)
	now := time.Now()
	for range 3 {
		model.RecordTokenRiskEventFromSample(1, 42, risk_setting.RiskEventConcurrentFp,
			`{"concurrent_fingerprints":3}`, now)
	}

	events, total, err := model.GetTokenRiskEvents(model.TokenRiskEventFilter{}, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total, "same token/type/hour must dedupe to one event")
	require.Len(t, events, 1)
	assert.Equal(t, 42, events[0].TokenId)
	assert.Equal(t, risk_setting.RiskEventConcurrentFp, events[0].EventType)
}

// TestTokenRiskEventMigrateIdempotent 验证重复迁移（AutoMigrate 幂等）与
// 唯一索引存在，防止再次出现普通索引导致 OnConflict 失效的回归。
func TestTokenRiskEventMigrateIdempotent(t *testing.T) {
	newRiskTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TokenRiskEvent{}))
	require.NoError(t, model.DB.AutoMigrate(&model.TokenRiskEvent{}))

	migrator := model.DB.Migrator()
	assert.True(t, migrator.HasTable(&model.TokenRiskEvent{}))
	for _, column := range []string{"user_id", "token_id", "event_type", "hour_bucket", "evidence", "status", "created_time"} {
		assert.True(t, migrator.HasColumn(&model.TokenRiskEvent{}, column), "column %s must exist", column)
	}
	assert.True(t, migrator.HasIndex(&model.TokenRiskEvent{}, "idx_risk_token_type_hour"),
		"dedup unique index must exist")
}
