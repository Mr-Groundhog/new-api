/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
import { api } from '@/lib/api'

import type {
  GithubStarApiResponse,
  GithubStarAuditLog,
  GithubStarClaimResult,
  GithubStarItemsPage,
  GithubStarRecheckResult,
  GithubStarRewardClaim,
  GithubStarRewardStatus,
} from './types'

export const githubStarRewardQueryKeys = {
  status: ['github-star-reward', 'status'] as const,
  claims: ['github-star-reward', 'claims'] as const,
  auditLogs: ['github-star-reward', 'audit-logs'] as const,
}

export type GithubStarClaimsQueryParams = {
  p: number
  page_size: number
  keyword?: string
  status?: string
}

export type GithubStarAuditLogsQueryParams = {
  p: number
  page_size: number
  claim_id?: number
}

function requireData<T>(
  response: GithubStarApiResponse<T>,
  fallback: string,
): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || fallback)
  }
  return response.data
}

export async function getGithubStarRewardStatus(): Promise<GithubStarRewardStatus> {
  const response = await api.get<
    GithubStarApiResponse<GithubStarRewardStatus>
  >('/api/github-star-reward', { skipErrorHandler: true, skipBusinessError: true })
  return requireData(response.data, 'GITHUB_STAR_REWARD_STATUS_LOAD_FAILED')
}

export async function claimGithubStarReward(): Promise<GithubStarClaimResult> {
  const response = await api.post<GithubStarApiResponse<GithubStarClaimResult>>(
    '/api/github-star-reward/claim',
    {},
    { skipErrorHandler: true, skipBusinessError: true },
  )
  return requireData(response.data, 'GITHUB_STAR_REWARD_CLAIM_FAILED')
}

export async function getGithubStarRewardClaims(
  params: GithubStarClaimsQueryParams,
): Promise<GithubStarItemsPage<GithubStarRewardClaim>> {
  const response = await api.get<
    GithubStarApiResponse<GithubStarItemsPage<GithubStarRewardClaim>>
  >('/api/github-star-reward/admin/claims', {
    params,
    skipErrorHandler: true,
  })
  return requireData(response.data, 'GITHUB_STAR_REWARD_CLAIMS_LOAD_FAILED')
}

export async function recheckGithubStarRewardClaim(
  id: number,
): Promise<GithubStarRecheckResult> {
  const response = await api.post<GithubStarApiResponse<GithubStarRecheckResult>>(
    `/api/github-star-reward/admin/claims/${id}/recheck`,
    {},
    { skipErrorHandler: true, skipBusinessError: true },
  )
  return requireData(response.data, 'GITHUB_STAR_REWARD_RECHECK_FAILED')
}

export async function approveGithubStarRewardClaim(
  id: number,
): Promise<GithubStarRewardClaim> {
  const response = await api.post<GithubStarApiResponse<GithubStarRewardClaim>>(
    `/api/github-star-reward/admin/claims/${id}/approve`,
    {},
    { skipErrorHandler: true, skipBusinessError: true },
  )
  return requireData(response.data, 'GITHUB_STAR_REWARD_APPROVE_FAILED')
}

export async function rejectGithubStarRewardClaim(
  id: number,
  reason: string,
): Promise<GithubStarRewardClaim> {
  const response = await api.post<GithubStarApiResponse<GithubStarRewardClaim>>(
    `/api/github-star-reward/admin/claims/${id}/reject`,
    { reason },
    { skipErrorHandler: true, skipBusinessError: true },
  )
  return requireData(response.data, 'GITHUB_STAR_REWARD_REJECT_FAILED')
}

export async function revokeGithubStarRewardClaim(
  id: number,
  reason: string,
): Promise<GithubStarRewardClaim> {
  const response = await api.post<GithubStarApiResponse<GithubStarRewardClaim>>(
    `/api/github-star-reward/admin/claims/${id}/revoke`,
    { reason },
    { skipErrorHandler: true, skipBusinessError: true },
  )
  return requireData(response.data, 'GITHUB_STAR_REWARD_REVOKE_FAILED')
}

export async function getGithubStarAuditLogs(
  params: GithubStarAuditLogsQueryParams,
): Promise<GithubStarItemsPage<GithubStarAuditLog>> {
  const response = await api.get<
    GithubStarApiResponse<GithubStarItemsPage<GithubStarAuditLog>>
  >('/api/github-star-reward/admin/audit-logs', {
    params,
    skipErrorHandler: true,
  })
  return requireData(response.data, 'GITHUB_STAR_REWARD_AUDIT_LOAD_FAILED')
}
