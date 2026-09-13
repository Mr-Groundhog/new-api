package setting

import (
	"slices"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// cooperationMethodDefaultIds 是未配置 CooperationMethodsAdmin 时的默认合作方式
// 全集（内置 8 种），与前端 features/cooperation/constants.ts 的内置目录同源。
var cooperationMethodDefaultIds = []string{
	"token", "invite", "content", "link", "community", "tech", "sponsor", "other",
}

// 合作方式配置的防滥用上限。MaxCooperationMethods 同时保证用户全选所有
// 方式时序列化 JSON（10×(16+3)+2=192）不会超出 applications.methods 列的
// varchar(200) 宽度。
const (
	MaxCooperationMethods    = 10 // 合作方式总数上限
	MaxCooperationMethodId   = 16 // 合作方式标识长度上限（ASCII）
	MaxCooperationMethodName = 50 // 合作方式名称长度上限（Unicode 码点）
)

// CooperationMethodsAdmin 选项以 JSON 数组记录管理员开放的合作方式。元素支持
// 两种形态：字符串（内置方式标识，旧格式）或对象 {"id":"...","label":"..."}
// （label 为管理员自定义名称，内置方式可省略以沿用默认翻译）。空 / 缺失 /
// 解析失败时回落默认内置全集，保证历史部署与管理员配置损坏都不会堵死申请。
var cooperationMethodsCache = struct {
	sync.RWMutex
	lastRaw string
	parsed  []string
	valid   bool
}{}

func parseCooperationMethodsRaw(raw string) ([]string, bool) {
	cooperationMethodsCache.RLock()
	if cooperationMethodsCache.lastRaw == raw {
		parsed, valid := cooperationMethodsCache.parsed, cooperationMethodsCache.valid
		cooperationMethodsCache.RUnlock()
		return parsed, valid
	}
	cooperationMethodsCache.RUnlock()

	cooperationMethodsCache.Lock()
	defer cooperationMethodsCache.Unlock()
	if cooperationMethodsCache.lastRaw == raw {
		return cooperationMethodsCache.parsed, cooperationMethodsCache.valid
	}

	parsed := []string{}
	valid := true
	if raw != "" {
		// 解析必须走 common 的 JSON 包装，禁止直接 encoding/json；
		// 元素形态是字符串或对象，先解成 any 再归一化
		var entries []any
		if err := common.UnmarshalJsonStr(raw, &entries); err != nil || entries == nil {
			parsed = []string{}
			valid = false
		} else {
			for _, entry := range entries {
				var id string
				switch value := entry.(type) {
				case string:
					id = value
				case map[string]any:
					id, _ = value["id"].(string)
				}
				id = strings.TrimSpace(id)
				if id == "" || len(id) > MaxCooperationMethodId {
					continue
				}
				if !slices.Contains(parsed, id) {
					parsed = append(parsed, id)
				}
				if len(parsed) >= MaxCooperationMethods {
					break
				}
			}
		}
	}
	cooperationMethodsCache.lastRaw = raw
	cooperationMethodsCache.parsed = parsed
	cooperationMethodsCache.valid = valid
	return parsed, valid
}

// GetEnabledCooperationMethodIds 返回当前开放的合作方式标识列表（含内置与
// 自定义）。解析失败 / 空配置 / 过滤后为空时回落默认内置全集。
func GetEnabledCooperationMethodIds() []string {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap["CooperationMethodsAdmin"]
	common.OptionMapRWMutex.RUnlock()

	parsed, valid := parseCooperationMethodsRaw(raw)
	if !valid || len(parsed) == 0 {
		return cooperationMethodDefaultIds
	}
	return parsed
}
