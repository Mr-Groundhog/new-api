package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// GetCooperationSites 返回对外展示的合作站点（公共页面数据）。路由已由
// HeaderNavModuleAuth("partners") 保护：模块关闭时直接 403，不会泄露站点列表。
func GetCooperationSites(c *gin.Context) {
	sites, err := model.GetEnabledCooperationSites()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, sites)
}

// GetAllCooperationSites 返回管理端全量合作站点列表（含停用），排序与公共
// 页面一致，方便管理员预览展示顺序。
func GetAllCooperationSites(c *gin.Context) {
	sites, err := model.GetAllCooperationSites()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, sites)
}

// AddCooperationSite 新建一条合作站点展示条目。
func AddCooperationSite(c *gin.Context) {
	var req service.CooperationSiteInput
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	site, err := service.ValidateCooperationSiteInput(&req)
	if err != nil {
		apiCooperationError(c, err)
		return
	}
	site.Id = 0
	if err := model.CreateCooperationSite(site); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "cooperation_site.create", map[string]any{
		"id":   site.Id,
		"name": site.Name,
	})
	common.ApiSuccess(c, site)
}

// UpdateCooperationSite 更新一条合作站点展示条目，请求体必须携带 id。
func UpdateCooperationSite(c *gin.Context) {
	var req service.CooperationSiteInput
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if req.Id <= 0 {
		common.ApiErrorI18n(c, i18n.MsgCooperationSiteNotFound)
		return
	}
	site, err := service.ValidateCooperationSiteInput(&req)
	if err != nil {
		apiCooperationError(c, err)
		return
	}
	if err := model.UpdateCooperationSite(site); err != nil {
		apiCooperationError(c, err)
		return
	}
	recordManageAudit(c, "cooperation_site.update", map[string]any{
		"id":   site.Id,
		"name": site.Name,
	})
	common.ApiSuccess(c, site)
}

// DeleteCooperationSite 删除一条合作站点展示条目。删除前先读出站点信息
// 用于审计日志，删除不存在的条目按不存在报错。
func DeleteCooperationSite(c *gin.Context) {
	id, ok := parseCooperationId(c)
	if !ok {
		return
	}
	site, err := model.GetCooperationSiteById(id)
	if err != nil {
		apiCooperationError(c, err)
		return
	}
	if err := model.DeleteCooperationSiteById(id); err != nil {
		apiCooperationError(c, err)
		return
	}
	recordManageAudit(c, "cooperation_site.delete", map[string]any{
		"id":   site.Id,
		"name": site.Name,
	})
	common.ApiSuccess(c, nil)
}
