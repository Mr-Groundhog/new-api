package controller

import (
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// cooperationErrorKeys 把 service / model 层返回的业务错误映射成 i18n 键；
// 未登记的错误原样透传给 common.ApiError。
var cooperationErrorKeys = []struct {
	err error
	key string
}{
	{model.ErrCooperationNotFound, i18n.MsgCooperationNotFound},
	{model.ErrCooperationPendingLimit, i18n.MsgCooperationPendingLimit},
	{model.ErrCooperationDailyLimit, i18n.MsgCooperationDailyLimit},
	{model.ErrCooperationNotPending, i18n.MsgCooperationNotPending},
	{model.ErrCooperationStatusInvalid, i18n.MsgCooperationStatusInvalid},
	{service.ErrCooperationDisabled, i18n.MsgCooperationDisabled},
	{service.ErrCooperationSiteNameLength, i18n.MsgCooperationSiteNameLength},
	{service.ErrCooperationSiteUrlInvalid, i18n.MsgCooperationSiteUrlInvalid},
	{service.ErrCooperationSiteTypeInvalid, i18n.MsgCooperationSiteTypeInvalid},
	{service.ErrCooperationDescriptionLength, i18n.MsgCooperationDescriptionLength},
	{service.ErrCooperationAudienceLength, i18n.MsgCooperationAudienceLength},
	{service.ErrCooperationMethodInvalid, i18n.MsgCooperationMethodInvalid},
	{service.ErrCooperationMethodDisabled, i18n.MsgCooperationMethodDisabled},
	{service.ErrCooperationSiteBannerInvalid, i18n.MsgCooperationSiteBannerInvalid},
	{service.ErrCooperationContactLength, i18n.MsgCooperationContactLength},
	{service.ErrCooperationNotesLength, i18n.MsgCooperationNotesLength},
	{service.ErrCooperationReviewNoteLength, i18n.MsgCooperationReviewNoteLength},
	{service.ErrCooperationRejectNoteRequired, i18n.MsgCooperationRejectNoteRequired},
	{model.ErrCooperationSiteNotFound, i18n.MsgCooperationSiteNotFound},
	{service.ErrCooperationSiteEntryNameLength, i18n.MsgCooperationSiteNameLength},
	{service.ErrCooperationSiteEntryUrlInvalid, i18n.MsgCooperationSiteUrlInvalid},
	{service.ErrCooperationSiteEntryImageInvalid, i18n.MsgCooperationSiteImageInvalid},
	{service.ErrCooperationSiteEntryDescriptionLength, i18n.MsgCooperationSiteDescriptionLength},
}

func apiCooperationError(c *gin.Context, err error) {
	for _, mapping := range cooperationErrorKeys {
		if err == mapping.err {
			common.ApiErrorI18n(c, mapping.key)
			return
		}
	}
	common.ApiError(c, err)
}

// parseCooperationId 解析路径参数中的申请 ID。非数字的 :id 按不存在返回而不是 500。
func parseCooperationId(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorI18n(c, i18n.MsgCooperationNotFound)
		return 0, false
	}
	return id, true
}

// GetMyCooperationApplications 返回当前用户自己的全部合作申请，按 ID 倒序。
func GetMyCooperationApplications(c *gin.Context) {
	apps, err := service.ListCooperationApplicationsForUser(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, apps)
}

// CreateCooperationApplication 提交合作申请。受用户端模块开关与限流约束，
// 成功后直接返回新申请，前端无需刷新列表反查。
func CreateCooperationApplication(c *gin.Context) {
	userId := c.GetInt("id")
	var req service.CooperationApplicationInput
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	now := time.Now()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	// 合作推广模块默认关闭：配置缺失 / 从未保存时视为关闭，与前端默认值一致
	moduleEnabled := setting.IsSidebarModuleEnabledDefaultClosed("personal", "cooperation")
	app, err := service.CreateCooperationApplicationForUser(userId, c.GetString("username"), &req, moduleEnabled, dayStart, now.Unix())
	if err != nil {
		apiCooperationError(c, err)
		return
	}
	common.ApiSuccess(c, app)
}

// GetCooperationApplications 分页查询管理端合作申请列表，支持
// status / user_id / keyword 过滤，按 ID 倒序。
func GetCooperationApplications(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId, _ := strconv.Atoi(c.Query("user_id"))
	filter := model.CooperationListFilter{
		UserId:  userId,
		Keyword: c.Query("keyword"),
	}
	if status, err := strconv.Atoi(c.Query("status")); err == nil {
		filter.Status = status
	}
	apps, total, err := model.GetCooperationApplications(filter, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(apps)
	common.ApiSuccess(c, pageInfo)
}

// GetCooperationStats 返回管理端合作申请概览，pending 驱动侧边栏待审红点。
func GetCooperationStats(c *gin.Context) {
	stats, err := service.GetCooperationStats()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stats)
}

// ReviewCooperationApplication 管理员审核一条待审核的合作申请：
// action 取 approve / reject，驳回必须填写原因。审核只记录结论与备注，
// 不自动变更用户额度或分组。
func ReviewCooperationApplication(c *gin.Context) {
	id, ok := parseCooperationId(c)
	if !ok {
		return
	}
	var req struct {
		Action string `json:"action"` // approve / reject
		Note   string `json:"note"`   // 审核备注（驳回时必填）
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	var targetStatus int
	switch req.Action {
	case "approve":
		targetStatus = model.CooperationStatusApproved
	case "reject":
		targetStatus = model.CooperationStatusRejected
	default:
		common.ApiErrorI18n(c, i18n.MsgCooperationStatusInvalid)
		return
	}
	note, err := service.ValidateCooperationReviewNote(req.Note, targetStatus)
	if err != nil {
		apiCooperationError(c, err)
		return
	}
	app, err := model.ReviewCooperationApplication(id, c.GetInt("id"), targetStatus, note, time.Now().Unix())
	if err != nil {
		apiCooperationError(c, err)
		return
	}

	action := "cooperation.approve"
	if targetStatus == model.CooperationStatusRejected {
		action = "cooperation.reject"
	}
	recordManageAuditFor(c, app.UserId, action, map[string]any{
		"id":        app.Id,
		"username":  app.Username,
		"site_name": app.SiteName,
	})
	common.ApiSuccess(c, app)
}

// DeleteCooperationApplication 删除一条合作申请（管理端）。删除前先读出
// 申请信息用于审计日志，删除不存在的申请按不存在报错。
func DeleteCooperationApplication(c *gin.Context) {
	id, ok := parseCooperationId(c)
	if !ok {
		return
	}
	app, err := model.GetCooperationApplicationById(id)
	if err != nil {
		apiCooperationError(c, err)
		return
	}
	if err := model.DeleteCooperationApplicationById(id); err != nil {
		apiCooperationError(c, err)
		return
	}
	recordManageAuditFor(c, app.UserId, "cooperation.delete", map[string]any{
		"id":        app.Id,
		"username":  app.Username,
		"site_name": app.SiteName,
	})
	common.ApiSuccess(c, nil)
}
