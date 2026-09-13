/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
export type GithubStarClaimStatus =
  | 'pending'
  | 'granted'
  | 'rejected'
  | 'revoked'

export type GithubStarRewardClaim = {
  id: number
  campaign_key: string
  user_id: number
  github_id: string
  github_login: string
  repository: string
  reward_quota: number
  status: GithubStarClaimStatus
  verification_method: string
  stargazer_page: number
  starred_at: number
  github_checked_at: number
  granted_at: number
  request_id: string
  revoked_at: number
  revoked_by: number
  revoke_reason: string
  created_time: number
  updated_time: number
}

export type GithubStarRewardStatus = {
  enabled: boolean
  campaign_key: string
  repository?: string
  repository_url?: string
  reward_quota?: number
  github_bound: boolean
  claim: GithubStarRewardClaim | null
}

export type GithubStarClaimResult = {
  status: 'pending' | 'granted'
  quota: number
  dry_run?: boolean
  repository_url?: string
}

export type GithubStarRecheckResult = {
  claim: GithubStarRewardClaim
  current: {
    matched: boolean
    starred_at: number
    page: number
    checked_at: number
  }
}

export type GithubStarAuditLog = {
  id: number
  claim_id: number
  campaign_key: string
  user_id: number
  github_id: string
  action: string
  result: string
  github_status_code: number
  github_page: number
  matched: boolean | null
  operator_id: number
  detail: string
  request_id: string
  created_time: number
}

export type GithubStarItemsPage<T> = {
  page: number
  page_size: number
  total: number
  items: T[] | null
}

export type GithubStarApiResponse<T> = {
  success: boolean
  data?: T
  message?: string
}
