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

import type {
  CooperationApiResponse,
  CooperationApplication,
  CooperationItemsPage,
  CooperationSiteEntry,
  CooperationStats,
  CreateCooperationPayload,
  ReviewCooperationAction,
  SaveCooperationSitePayload,
} from './types'

export const cooperationQueryKeys = {
  myApplications: ['cooperation', 'my-applications'] as const,
  adminList: ['cooperation', 'adminList'] as const,
  adminStats: ['cooperation', 'adminStats'] as const,
  adminSites: ['cooperation', 'adminSites'] as const,
}

function requireData<T>(
  response: CooperationApiResponse<T>,
  fallback: string
): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || fallback)
  }
  return response.data
}

// ============================================================================
// User side
// ============================================================================

export async function getMyCooperationApplications(): Promise<
  CooperationApplication[]
> {
  const response = await api.get<
    CooperationApiResponse<CooperationApplication[]>
  >('/api/cooperation/my-applications', { skipErrorHandler: true })
  return requireData(response.data, 'Failed to load applications')
}

export async function createCooperationApplication(
  payload: CreateCooperationPayload
): Promise<CooperationApplication> {
  const response = await api.post<
    CooperationApiResponse<CooperationApplication>
  >('/api/cooperation/apply', payload, { skipErrorHandler: true })
  return requireData(response.data, 'Failed to submit application')
}

// ============================================================================
// Admin side
// ============================================================================

export type AdminCooperationListParams = {
  p: number
  page_size: number
  status?: string
  keyword?: string
}

export async function getCooperationApplications(
  params: AdminCooperationListParams
): Promise<CooperationItemsPage> {
  const response = await api.get<CooperationApiResponse<CooperationItemsPage>>(
    '/api/cooperation/admin',
    { params, skipErrorHandler: true }
  )
  return requireData(response.data, 'Failed to load applications')
}

export async function getCooperationStats(): Promise<CooperationStats> {
  const response = await api.get<CooperationApiResponse<CooperationStats>>(
    '/api/cooperation/admin/stats',
    { skipErrorHandler: true }
  )
  return requireData(response.data, 'Failed to load stats')
}

export async function reviewCooperationApplication(
  id: number,
  action: ReviewCooperationAction,
  note: string
): Promise<CooperationApplication> {
  const response = await api.put<
    CooperationApiResponse<CooperationApplication>
  >(
    `/api/cooperation/admin/${id}/review`,
    { action, note },
    {
      skipErrorHandler: true,
    }
  )
  return requireData(response.data, 'Failed to review application')
}

export async function deleteCooperationApplication(id: number): Promise<void> {
  const response = await api.delete<CooperationApiResponse<null>>(
    `/api/cooperation/admin/${id}`,
    { skipErrorHandler: true }
  )
  requireData(response.data, 'Failed to delete application')
}

// ============================================================================
// Admin side — cooperation sites (「合作站点」公共页面数据源)
// ============================================================================

export async function getAdminCooperationSites(): Promise<
  CooperationSiteEntry[]
> {
  const response = await api.get<
    CooperationApiResponse<CooperationSiteEntry[]>
  >('/api/cooperation/admin/sites', { skipErrorHandler: true })
  return requireData(response.data, 'Failed to load sites')
}

export async function addCooperationSite(
  payload: SaveCooperationSitePayload
): Promise<CooperationSiteEntry> {
  const response = await api.post<CooperationApiResponse<CooperationSiteEntry>>(
    '/api/cooperation/admin/sites',
    payload,
    { skipErrorHandler: true }
  )
  return requireData(response.data, 'Failed to create site')
}

export async function updateCooperationSite(
  payload: SaveCooperationSitePayload
): Promise<CooperationSiteEntry> {
  const response = await api.put<CooperationApiResponse<CooperationSiteEntry>>(
    '/api/cooperation/admin/sites',
    payload,
    { skipErrorHandler: true }
  )
  return requireData(response.data, 'Failed to update site')
}

export async function deleteCooperationSite(id: number): Promise<void> {
  const response = await api.delete<CooperationApiResponse<null>>(
    `/api/cooperation/admin/sites/${id}`,
    { skipErrorHandler: true }
  )
  requireData(response.data, 'Failed to delete site')
}
