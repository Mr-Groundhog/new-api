package setting

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
)

func setCooperationMethodsOption(t *testing.T, value string) {
	t.Helper()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMapRWMutex.Lock()
	previous, hadPrevious := common.OptionMap["CooperationMethodsAdmin"]
	common.OptionMap["CooperationMethodsAdmin"] = value
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		if hadPrevious {
			common.OptionMap["CooperationMethodsAdmin"] = previous
		} else {
			delete(common.OptionMap, "CooperationMethodsAdmin")
		}
	})
}

func TestGetEnabledCooperationMethodIds(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want []string
	}{
		{name: "empty option falls back to built-in defaults", raw: "", want: cooperationMethodDefaultIds},
		{name: "invalid json falls back to built-in defaults", raw: "{not-json", want: cooperationMethodDefaultIds},
		{name: "legacy string array (old format) parsed as ids", raw: `["token","invite"]`, want: []string{"token", "invite"}},
		{name: "object entries parsed with ids", raw: `[{"id":"token"},{"id":"custom_ab12","label":"API 赞助"}]`, want: []string{"token", "custom_ab12"}},
		{name: "mixed string and object entries", raw: `["invite",{"id":"custom_x","label":"X"}]`, want: []string{"invite", "custom_x"}},
		{name: "blank and missing ids dropped", raw: `[{"id":" "},{"label":"no id"},"token"]`, want: []string{"token"}},
		{name: "over-length id dropped", raw: `["` + strings.Repeat("a", MaxCooperationMethodId+1) + `","token"]`, want: []string{"token"}},
		{name: "duplicate ids deduped", raw: `["token",{"id":"token","label":"T"}]`, want: []string{"token"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setCooperationMethodsOption(t, tt.raw)
			got := GetEnabledCooperationMethodIds()
			if tt.name == "entries clamped to cap" {
				assert.Len(t, got, MaxCooperationMethods)
				return
			}
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestGetEnabledCooperationMethodIdsClampedToCap(t *testing.T) {
	// 超出上限的条目被截断，防止用户全选时 methods 列 JSON 超出列宽
	entries := make([]string, 0, MaxCooperationMethods+3)
	for i := range MaxCooperationMethods + 3 {
		entries = append(entries, `{"id":"c`+string(rune('a'+i%26))+"x"+string(rune('a'+i/26))+`"}`)
	}
	setCooperationMethodsOption(t, `[`+strings.Join(entries, ",")+`]`)
	got := GetEnabledCooperationMethodIds()
	assert.Len(t, got, MaxCooperationMethods)
}

func TestGetEnabledCooperationMethodIdsEmptyAfterParseFallsBack(t *testing.T) {
	// 解析成功但过滤后为空（例如数组里全是非法项）时回落默认全集，
	// 保证配置损坏不会把申请入口堵死
	setCooperationMethodsOption(t, `[{"label":"no id"}]`)
	assert.Equal(t, cooperationMethodDefaultIds, GetEnabledCooperationMethodIds())
}
