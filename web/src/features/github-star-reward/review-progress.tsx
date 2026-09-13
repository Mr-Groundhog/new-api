/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
import { Check, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatTimestampToDate } from '@/lib/format'

import type { GithubStarRewardClaim } from './types'

type StageState = 'done' | 'current' | 'upcoming' | 'failed' | 'warning'

type StageNote = {
  text: string
  className: string
}

type Stage = {
  key: string
  label: string
  state: StageState
  time: number
  note?: StageNote
}

const stageIconClass: Record<StageState, string> = {
  done: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500',
  current: 'border-primary/40 bg-primary/10 text-primary',
  upcoming: 'border-muted-foreground/25 bg-muted/50 text-muted-foreground',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning: 'border-destructive/40 bg-destructive/10 text-destructive',
}

// 领取状态 →（管理员审核阶段状态, 额度到账阶段状态）。前两个阶段（申请、
// 系统检测）在落库时即完成，不随状态变化。
const stageStatesByStatus: Record<
  GithubStarRewardClaim['status'],
  { review: StageState; credit: StageState }
> = {
  pending: { review: 'current', credit: 'upcoming' },
  granted: { review: 'done', credit: 'done' },
  rejected: { review: 'failed', credit: 'failed' },
  revoked: { review: 'done', credit: 'warning' },
}

function StageStateIcon(props: { state: StageState }) {
  switch (props.state) {
    case 'done':
      return <Check className='size-4' aria-hidden='true' />
    case 'current':
      return <LoaderCircle className='size-4 animate-spin' aria-hidden='true' />
    case 'failed':
      return <X className='size-4' aria-hidden='true' />
    case 'warning':
      return <TriangleAlert className='size-4' aria-hidden='true' />
    default:
      return (
        <span className='size-1.5 rounded-full bg-current' aria-hidden='true' />
      )
  }
}

// ReviewProgress 在奖励弹窗内展示申请的四阶段审核进度：
// 用户申请领取 → 系统审核 → 管理员审核 → 额度到账。各阶段状态由领取记录的
// status 与时间戳推导；拒绝 / 撤销等否定结果在对应阶段上就地标注原因。
export function ReviewProgress(props: { claim: GithubStarRewardClaim }) {
  const { t } = useTranslation()
  const claim = props.claim
  const stageStates = stageStatesByStatus[claim.status]

  let adminNote: StageNote | undefined
  let creditNote: StageNote | undefined
  if (claim.status === 'pending') {
    adminNote = {
      text: t('Waiting for admin review'),
      className: 'text-primary',
    }
  } else if (claim.status === 'rejected' && claim.revoke_reason) {
    adminNote = {
      text: `${t('Rejection reason')}: ${claim.revoke_reason}`,
      className: 'text-destructive',
    }
  }
  if (claim.status === 'rejected') {
    creditNote = {
      text: t('Reward not granted'),
      className: 'text-destructive',
    }
  } else if (claim.status === 'revoked') {
    creditNote = {
      text: t('Credited then revoked by admin. The quota has been deducted.'),
      className: 'text-destructive',
    }
  }

  const reviewAt = claim.status === 'granted' ? claim.granted_at : claim.revoked_at
  const stages: Stage[] = [
    {
      key: 'claimed',
      label: t('User claimed'),
      state: 'done',
      time: claim.created_time,
    },
    {
      key: 'system',
      label: t('System verification'),
      state: 'done',
      time: claim.github_checked_at,
    },
    {
      key: 'admin',
      label: t('Admin review'),
      state: stageStates.review,
      time: reviewAt,
      note: adminNote,
    },
    {
      key: 'credit',
      label: t('Quota credited'),
      state: stageStates.credit,
      time: claim.status === 'granted' ? claim.granted_at : 0,
      note: creditNote,
    },
  ]

  return (
    <div className='space-y-4'>
      <h3 className='text-sm font-semibold'>{t('Claimed progress')}</h3>
      <ol>
        {stages.map((stage, index) => (
          <li key={stage.key} className='relative flex gap-3 pb-5 last:pb-0'>
            {index < stages.length - 1 && (
              <span
                className={`absolute top-9 bottom-0 left-[17px] w-0.5 ${
                  stage.state === 'done' ? 'bg-emerald-500/30' : 'bg-border'
                }`}
                aria-hidden='true'
              />
            )}
            <span
              className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border ${stageIconClass[stage.state]}`}
            >
              <StageStateIcon state={stage.state} />
            </span>
            <div className='min-w-0 pt-1.5'>
              <p className='text-sm leading-none font-medium'>{stage.label}</p>
              {stage.time > 0 && (
                <p className='text-muted-foreground mt-1.5 text-xs'>
                  {formatTimestampToDate(stage.time)}
                </p>
              )}
              {stage.note && (
                <p className={`mt-1.5 text-xs ${stage.note.className}`}>
                  {stage.note.text}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {claim.status === 'pending' && (
        <p className='bg-muted text-muted-foreground rounded-lg p-3 text-xs leading-relaxed'>
          {t(
            'No need to claim again. The system syncs star records every 8 hours; check the review progress here anytime. Contact the admin via a ticket if you have any questions.',
          )}
        </p>
      )}
    </div>
  )
}
