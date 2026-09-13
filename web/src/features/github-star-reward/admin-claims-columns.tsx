/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import { GithubStarRowActions } from './admin-claims-row-actions'
import { GITHUB_STAR_STATUS_LABELS } from './constants'
import type { GithubStarRewardClaim } from './types'

// 列定义只保留复审关键字段：用户与 GitHub 身份、奖励额度、状态、发放时间。
// 检测细节（检测时间、页码、Star 时间、请求 ID、仓库）通过行操作里的
// 审计日志弹窗查看。
export function useGithubStarClaimsColumns(): ColumnDef<GithubStarRewardClaim>[] {
  const { t } = useTranslation()
  return [
    {
      accessorKey: 'id',
      header: t('ID'),
      cell: ({ row }) => (
        <TableId value={row.getValue('id') as number} className='w-[60px]' />
      ),
      size: 80,
    },
    {
      accessorKey: 'user_id',
      header: t('User ID'),
      cell: ({ row }) => (
        <span className='font-mono text-sm'>{row.getValue('user_id')}</span>
      ),
      size: 90,
    },
    {
      accessorKey: 'github_id',
      header: t('GitHub ID'),
      cell: ({ row }) => (
        <span className='font-mono text-sm'>{row.getValue('github_id')}</span>
      ),
      size: 120,
    },
    {
      accessorKey: 'github_login',
      header: t('GitHub Login'),
      cell: ({ row }) => (
        <span className='truncate text-sm'>
          {(row.getValue('github_login') as string) || '-'}
        </span>
      ),
      size: 130,
    },
    {
      accessorKey: 'reward_quota',
      header: t('Reward'),
      cell: ({ row }) => (
        <span className='font-mono text-sm'>
          {formatQuota(row.getValue('reward_quota') as number)}
        </span>
      ),
      size: 110,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => {
        const claim = row.original
        const negative =
          claim.status === 'rejected' || claim.status === 'revoked'
        let variant: 'success' | 'warning' | 'danger' = 'success'
        if (claim.status === 'pending') {
          variant = 'warning'
        } else if (negative) {
          variant = 'danger'
        }
        return (
          <div className='min-w-0'>
            <StatusBadge
              label={t(GITHUB_STAR_STATUS_LABELS[claim.status])}
              variant={variant}
              copyable={false}
              className='-ml-1.5'
            />
            {negative && claim.revoke_reason && (
              <p
                className='text-muted-foreground mt-1 max-w-[180px] truncate text-xs'
                title={claim.revoke_reason}
              >
                {claim.revoke_reason}
              </p>
            )}
          </div>
        )
      },
      size: 150,
    },
    {
      accessorKey: 'granted_at',
      header: t('Granted at'),
      cell: ({ row }) => (
        <span className='text-muted-foreground whitespace-nowrap text-xs'>
          {formatTimestampToDate(row.getValue('granted_at') as number)}
        </span>
      ),
      size: 150,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <GithubStarRowActions claim={row.original} />,
      meta: { pinned: 'right' as const },
    },
  ]
}
