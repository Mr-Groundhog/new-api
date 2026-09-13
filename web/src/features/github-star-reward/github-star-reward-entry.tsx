/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
import { Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatQuota } from '@/lib/format'

import { RewardCard } from './reward-card'
import {
  claimGithubStarReward,
  getGithubStarRewardStatus,
  githubStarRewardQueryKeys,
} from './api'

// GithubStarRewardEntry 是嵌入福利空投页头部操作区的 GitHub Star 奖励入口：
// 一个打开奖励弹窗的小按钮。活动未开启（或状态加载失败）时不渲染任何内容，
// 福利空投页保持原有布局不变。
export function GithubStarRewardEntry() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: githubStarRewardQueryKeys.status,
    queryFn: getGithubStarRewardStatus,
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: claimGithubStarReward,
    onSuccess: (result) => {
      if (result.dry_run) {
        toast.success(
          t('Star verified successfully. The reward will be granted once the activity is fully enabled.'),
        )
      } else if (result.status === 'pending') {
        toast.success(t('Claim submitted. Waiting for admin review'))
      } else {
        toast.success(
          t('Successfully received {{quota}} credit, added to your wallet', {
            quota: formatQuota(result.quota),
          }),
        )
      }
      void client.invalidateQueries({
        queryKey: githubStarRewardQueryKeys.status,
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Unable to complete the claim. Please try again.'),
      )
    },
  })

  const status = query.data
  if (query.isLoading || query.isError || !status?.enabled) {
    return null
  }

  return (
    <>
      <Button variant='outline' size='sm' onClick={() => setOpen(true)}>
        <Star aria-hidden='true' />
        {status.campaign_key || t('GitHub Star')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Star className='size-4' aria-hidden='true' />
              {t('GitHub Star Reward')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'Star our GitHub repository with the bound account to claim a one-time credit reward.',
              )}
            </DialogDescription>
          </DialogHeader>
          <RewardCard
            status={status}
            pending={mutation.isPending}
            onClaim={() => mutation.mutate()}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
