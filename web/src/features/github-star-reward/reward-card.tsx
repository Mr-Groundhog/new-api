/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'
import { ExternalLink, LoaderCircle, RotateCw, Star } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { formatQuota } from '@/lib/format'

import { ReviewProgress } from './review-progress'
import type { GithubStarRewardStatus } from './types'

// RewardCard 展示 GitHub Star 奖励的活动信息、绑定状态与领取入口，
// 在福利空投页的奖励弹窗内使用。已提交申请的用户看到四阶段审核进度图。
export function RewardCard(props: {
  status: GithubStarRewardStatus
  pending: boolean
  onClaim: () => void
}) {
  const { t } = useTranslation()
  const claim = props.status.claim
  const [reapplyOpen, setReapplyOpen] = useState(false)
  let body: ReactNode
  if (!props.status.github_bound) {
    body = (
      <div className='flex flex-col items-start gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-muted-foreground text-sm'>
          {t('Please bind your GitHub account before claiming the reward.')}
        </p>
        <Button variant='outline' size='sm' render={<Link to='/security' />}>
          {t('Go to security settings')}
        </Button>
      </div>
    )
  } else if (claim) {
    body = (
      <div className='space-y-4'>
        <div className='rounded-lg border p-4'>
          <ReviewProgress claim={claim} />
        </div>
        {claim.status === 'rejected' && (
          <>
            <Button
              className='h-11 w-full rounded-full transition-all duration-300 hover:-translate-y-0.5'
              onClick={() => setReapplyOpen(true)}
            >
              <RotateCw aria-hidden='true' />
              {t('Re-apply')}
            </Button>
            <ConfirmDialog
              open={reapplyOpen}
              onOpenChange={setReapplyOpen}
              title={t('Re-apply for the reward')}
              desc={t(
                'Please confirm that you have starred the repository {{repository}}. If you starred it just now, detection may take a few minutes to catch up — wait a while before retrying.',
                { repository: props.status.repository ?? '' }
              )}
              confirmText={t('Confirm and re-apply')}
              isLoading={props.pending}
              handleConfirm={() => {
                setReapplyOpen(false)
                props.onClaim()
              }}
            />
          </>
        )}
      </div>
    )
  } else {
    body = (
      <Button
        className='h-11 w-full rounded-full transition-all duration-300 hover:-translate-y-0.5'
        disabled={props.pending}
        onClick={props.onClaim}
      >
        {props.pending ? (
          <LoaderCircle className='animate-spin' aria-hidden='true' />
        ) : (
          <Star aria-hidden='true' />
        )}
        {props.pending ? t('Claiming...') : t('Claim reward')}
      </Button>
    )
  }

  return (
    <div className='space-y-5'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='rounded-lg border bg-black/[0.02] p-3 dark:bg-white/[0.02]'>
          <span className='text-muted-foreground text-xs'>
            {t('Repository')}
          </span>
          <a
            href={props.status.repository_url}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary mt-1.5 flex items-center gap-1.5 truncate font-mono text-sm hover:underline'
          >
            <span className='truncate'>{props.status.repository}</span>
            <ExternalLink className='size-3.5 shrink-0' aria-hidden='true' />
          </a>
        </div>
        <div className='rounded-lg border bg-black/[0.02] p-3 dark:bg-white/[0.02]'>
          <span className='text-muted-foreground text-xs'>
            {t('Credit per claim')}
          </span>
          <strong className='text-primary mt-1.5 block font-mono text-lg'>
            {formatQuota(props.status.reward_quota ?? 0)}
          </strong>
        </div>
      </div>
      {body}
    </div>
  )
}
