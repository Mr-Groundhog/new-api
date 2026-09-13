package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

var (
	ErrCooperationSiteNotFound = errors.New("合作站点不存在")
)

// CooperationSite 是管理端维护的合作站点展示条目，驱动「合作站点」公共页面：
// 重点合作（Featured）站点进入轮播区，其余以卡片形式按排序展示。
// 表名：cooperation_sites
type CooperationSite struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`                                      // 主键，自增 ID
	Name        string `json:"name" gorm:"type:varchar(191);not null"`                                  // 站点名称，业务上限 50 个字符（按 Unicode 码点计），列宽留余量以容纳 4 字节字符
	Url         string `json:"url" gorm:"type:varchar(255);not null"`                                   // 站点链接，必须是 http(s) URL，业务上限 200 个字符（按 Unicode 码点计）
	Logo        string `json:"logo" gorm:"type:varchar(255);not null;default:''"`                       // 站点 Logo 图片链接（可选），业务上限 200 个字符；卡片无 Logo 时以名称首字回退
	Banner      string `json:"banner" gorm:"type:varchar(255);not null;default:''"`                     // 轮播图图片链接（可选，仅重点站点使用），业务上限 200 个字符；无图时轮播以渐变背景渲染
	Description string `json:"description" gorm:"type:varchar(500);not null;default:''"`                // 站点简介，业务上限 200 个字符（按 Unicode 码点计）
	Featured    bool   `json:"featured" gorm:"index:idx_cooperation_site_featured_sort"`                // 是否重点合作站点：进入页面顶部轮播区
	Sort        int    `json:"sort" gorm:"not null;default:0;index:idx_cooperation_site_featured_sort"` // 展示排序权重，序号越小越靠前；同序号按 ID 升序
	Enabled     bool   `json:"enabled" gorm:"index"`                                                    // 是否对外展示；业务默认值由代码归一化（新建默认 true），不用列默认值以避免跨库 boolean 默认差异
	CreatedTime int64  `json:"created_time" gorm:"bigint;not null"`                                     // 创建时间（Unix 秒）
	UpdatedTime int64  `json:"updated_time" gorm:"bigint;not null"`                                     // 最后变更时间（Unix 秒）
}

func (CooperationSite) TableName() string {
	return "cooperation_sites"
}

// GetEnabledCooperationSites 返回对外展示的合作站点，按「序号升序 → ID 升序」
// 排序，序号越小越靠前。公共页面按 Featured 字段自行划分轮播区与卡片区。
func GetEnabledCooperationSites() ([]*CooperationSite, error) {
	var sites []*CooperationSite
	err := DB.Where("enabled = ?", true).
		Order("sort ASC, id ASC").
		Find(&sites).Error
	return sites, err
}

// GetAllCooperationSites 返回全部合作站点（含停用），管理端列表用，
// 排序与公共页面一致，方便管理员预览展示顺序。
func GetAllCooperationSites() ([]*CooperationSite, error) {
	var sites []*CooperationSite
	err := DB.Order("sort ASC, id ASC").Find(&sites).Error
	return sites, err
}

// GetCooperationSiteById 按主键读取一条合作站点。
func GetCooperationSiteById(id int) (*CooperationSite, error) {
	if id <= 0 {
		return nil, ErrCooperationSiteNotFound
	}
	site := &CooperationSite{}
	err := DB.First(site, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrCooperationSiteNotFound
	}
	if err != nil {
		return nil, err
	}
	return site, nil
}

// CreateCooperationSite 新建一条合作站点记录。
func CreateCooperationSite(site *CooperationSite) error {
	now := common.GetTimestamp()
	site.CreatedTime = now
	site.UpdatedTime = now
	return DB.Create(site).Error
}

// UpdateCooperationSite 按主键整体更新一条合作站点；站点不存在时返回
// ErrCooperationSiteNotFound，不静默成功。
func UpdateCooperationSite(site *CooperationSite) error {
	if site.Id <= 0 {
		return ErrCooperationSiteNotFound
	}
	result := DB.Model(&CooperationSite{}).
		Where("id = ?", site.Id).
		Updates(map[string]any{
			"name":         site.Name,
			"url":          site.Url,
			"logo":         site.Logo,
			"banner":       site.Banner,
			"description":  site.Description,
			"featured":     site.Featured,
			"sort":         site.Sort,
			"enabled":      site.Enabled,
			"updated_time": common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrCooperationSiteNotFound
	}
	return nil
}

// DeleteCooperationSiteById 删除一条合作站点记录；不存在时返回
// ErrCooperationSiteNotFound。
func DeleteCooperationSiteById(id int) error {
	if id <= 0 {
		return ErrCooperationSiteNotFound
	}
	result := DB.Where("id = ?", id).Delete(&CooperationSite{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrCooperationSiteNotFound
	}
	return nil
}
