/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
import type { TFunction } from 'i18next'

// 与后端 model.GithubStarClaimStatus* 常量保持一致。
export const GITHUB_STAR_CLAIM_STATUSES = [
  'pending',
  'granted',
  'rejected',
  'revoked',
] as const
export type GithubStarClaimStatusValue = (typeof GITHUB_STAR_CLAIM_STATUSES)[number]

export function getGithubStarStatusOptions(t: TFunction) {
  return GITHUB_STAR_CLAIM_STATUSES.map((status) => ({
    label: t(GITHUB_STAR_STATUS_LABELS[status]),
    value: status,
  }))
}

// 状态展示文案。键为后端状态值，值为 i18n 键（英文源串）。
export const GITHUB_STAR_STATUS_LABELS: Record<
  GithubStarClaimStatusValue,
  string
> = {
  pending: 'Pending review',
  granted: 'Granted',
  rejected: 'Rejected',
  revoked: 'Revoked',
}

// 审计日志 action 展示文案。键为后端 GithubStarAuditAction* 常量值，
// 值为 i18n 键，已登记到 src/i18n/static-keys.ts。
export const GITHUB_STAR_AUDIT_ACTION_LABELS: Record<string, string> = {
  claim: 'Claim',
  approve: 'Approve',
  reject: 'Reject',
  recheck: 'Recheck',
  revoke: 'Revoke',
  sync: 'Sync',
}

// 审计日志 result 展示文案。键为后端 GithubStarAuditResult* 常量值。
// granted 仅供历史日志展示：审批流上线前申请即发放，当时的 claim 审计 result
// 为 granted。
export const GITHUB_STAR_AUDIT_RESULT_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  granted: 'Granted',
  granted_dry_run: 'Granted (dry run)',
  already_claimed: 'Already claimed',
  rejected_not_starred: 'Not starred',
  rejected_token: 'Token invalid',
  rejected_error: 'Check failed',
  approved: 'Approved',
  rejected_by_admin: 'Rejected by admin',
  recheck_done: 'Recheck completed',
  revoke_done: 'Revoked',
  sync_success: 'Sync succeeded',
  sync_failed: 'Sync failed',
}
