/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { useStatus } from '@/hooks/use-status'

import {
  COOPERATION_SITE_TYPES,
  COOPERATION_STATUSES,
  getCooperationMethodLabel,
  getCooperationMethodOptions,
  parseCooperationMethods,
} from '../constants'

/** 审核状态徽标；未知状态回落为中性展示，不抛错。 */
export function CooperationStatusBadge(props: { status: number }) {
  const { t } = useTranslation()
  const config = COOPERATION_STATUSES[props.status]
  if (!config) {
    return (
      <StatusBadge label={t('Unknown')} variant='neutral' copyable={false} />
    )
  }
  return (
    <StatusBadge
      label={t(config.labelKey)}
      variant={config.variant}
      copyable={false}
    />
  )
}

/** 合作方式标签组；文案按管理端配置解析（自定义名 > 内置翻译 > id 原文），
 * 解析失败时静默渲染为空。 */
export function CooperationMethodTags(props: { methods: string }) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const ids = parseCooperationMethods(props.methods)
  const options = getCooperationMethodOptions(
    status?.CooperationMethodsAdmin as string | null | undefined
  )
  if (ids.length === 0) return null
  return (
    <div className='flex flex-wrap gap-1'>
      {ids.map((id) => {
        const option = options.find((entry) => entry.id === id)
        return (
          <Badge key={id} variant='secondary' className='text-xs font-normal'>
            {getCooperationMethodLabel(option, id, t)}
          </Badge>
        )
      })}
    </div>
  )
}

/** 站点类型文案；未知标识回落为 '-'。 */
export function CooperationSiteTypeLabel(props: { siteType: string }) {
  const { t } = useTranslation()
  const config =
    COOPERATION_SITE_TYPES[
      props.siteType as keyof typeof COOPERATION_SITE_TYPES
    ]
  if (!config) return <span>-</span>
  return <span>{t(config.labelKey)}</span>
}
