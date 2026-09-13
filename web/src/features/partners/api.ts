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

import { api } from '@/lib/api'

import type { PartnerSite, PartnerSiteApiResponse } from './types'

export const partnersQueryKeys = {
  sites: ['partners', 'sites'] as const,
}

function requireData<T>(
  response: PartnerSiteApiResponse<T>,
  fallback: string
): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || fallback)
  }
  return response.data
}

/** 获取对外展示的合作站点（后端已按 sort 升序排序并过滤停用条目）。 */
export async function getPartnerSites(): Promise<PartnerSite[]> {
  const response = await api.get<PartnerSiteApiResponse<PartnerSite[]>>(
    '/api/cooperation/sites',
    { skipErrorHandler: true }
  )
  return requireData(response.data, 'Failed to load partner sites')
}
