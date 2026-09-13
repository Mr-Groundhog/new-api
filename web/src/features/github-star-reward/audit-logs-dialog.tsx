/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
import { ClipboardList, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatTimestampToDate } from '@/lib/format'

import {
  getGithubStarAuditLogs,
  githubStarRewardQueryKeys,
} from './api'
import {
  GITHUB_STAR_AUDIT_ACTION_LABELS,
  GITHUB_STAR_AUDIT_RESULT_LABELS,
} from './constants'
import type {
  GithubStarAuditLog,
  GithubStarRewardClaim,
} from './types'

function AuditEntry(props: { entry: GithubStarAuditLog }) {
  const { t } = useTranslation()
  const entry = props.entry
  const actionLabel = GITHUB_STAR_AUDIT_ACTION_LABELS[entry.action] ?? entry.action
  const resultLabel = GITHUB_STAR_AUDIT_RESULT_LABELS[entry.result] ?? entry.result
  return (
    <div className='border-b py-3 last:border-b-0'>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
        <span className='text-xs font-medium'>
          {t(actionLabel)}
          <span className='text-muted-foreground'> · {t(resultLabel)}</span>
        </span>
        {entry.matched !== null && (
          <span
            className={
              entry.matched
                ? 'text-xs text-emerald-500'
                : 'text-xs text-destructive'
            }
          >
            {entry.matched ? t('Matched') : t('Not matched')}
          </span>
        )}
        {entry.github_page > 0 && (
          <span className='text-muted-foreground text-xs'>
            {t('Page')}: {entry.github_page}
          </span>
        )}
        {entry.github_status_code > 0 && (
          <span className='text-muted-foreground font-mono text-xs'>
            HTTP {entry.github_status_code}
          </span>
        )}
        {entry.operator_id > 0 && (
          <span className='text-muted-foreground text-xs'>
            {t('Operator ID')}: {entry.operator_id}
          </span>
        )}
      </div>
      <p className='text-muted-foreground mt-1 text-xs'>
        {formatTimestampToDate(entry.created_time)}
        {entry.request_id ? ` · ${entry.request_id}` : ''}
      </p>
      {entry.detail && (
        <p className='text-muted-foreground mt-1 break-all text-xs'>
          {entry.detail}
        </p>
      )}
    </div>
  )
}

// GithubStarAuditLogsDialog 展示某条领取记录关联的全部检测与操作证据，
// 供管理员复审追溯（方案 4.4 / 8.1）。
export function GithubStarAuditLogsDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  claim: GithubStarRewardClaim
}) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: [...githubStarRewardQueryKeys.auditLogs, props.claim.id],
    queryFn: () =>
      getGithubStarAuditLogs({ p: 1, page_size: 50, claim_id: props.claim.id }),
    enabled: props.open,
  })
  const entries = query.data?.items ?? []

  let list: ReactNode
  if (query.isLoading || query.isFetching) {
    list = (
      <div className='text-muted-foreground flex justify-center py-8'>
        <LoaderCircle className='size-6 animate-spin' aria-hidden='true' />
      </div>
    )
  } else if (entries.length === 0) {
    list = (
      <p className='text-muted-foreground py-8 text-center text-sm'>
        {t('No audit logs yet')}
      </p>
    )
  } else {
    list = entries.map((entry) => <AuditEntry key={entry.id} entry={entry} />)
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[80vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ClipboardList className='size-4' aria-hidden='true' />
            {t('Audit logs')}
          </DialogTitle>
          <DialogDescription>
            {t('Claim #{{id}}', { id: props.claim.id })} ·{' '}
            {props.claim.github_login || props.claim.github_id} ·{' '}
            {props.claim.repository}
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-24'>{list}</div>
      </DialogContent>
    </Dialog>
  )
}
