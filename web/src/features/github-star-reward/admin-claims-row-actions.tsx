/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  CircleX,
  ClipboardList,
  LoaderCircle,
  RotateCw,
  ShieldX,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { formatQuota } from '@/lib/format'

import {
  approveGithubStarRewardClaim,
  githubStarRewardQueryKeys,
  recheckGithubStarRewardClaim,
  rejectGithubStarRewardClaim,
  revokeGithubStarRewardClaim,
} from './api'
import { GithubStarAuditLogsDialog } from './audit-logs-dialog'
import type { GithubStarRewardClaim } from './types'

// GithubStarRowActions 提供管理员复审操作（方案第 8 节）：批准 / 拒绝待审批
// 申请直接外露为按钮；重新检测、查看审计日志、撤销已发放奖励收进行操作菜单。
// 拒绝与撤销需填写原因并二次确认。
export function GithubStarRowActions(props: { claim: GithubStarRewardClaim }) {
  const { t } = useTranslation()
  const claim = props.claim
  const client = useQueryClient()
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const invalidate = () => {
    void client.invalidateQueries({
      queryKey: githubStarRewardQueryKeys.claims,
    })
  }

  const recheckMutation = useMutation({
    mutationFn: () => recheckGithubStarRewardClaim(claim.id),
    onSuccess: (result) => {
      invalidate()
      if (result.current.matched) {
        toast.success(
          t('Recheck passed: the GitHub account is currently starred')
        )
      } else {
        toast.warning(
          t('Recheck result: the GitHub account is not starred currently')
        )
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('Operation failed')
      )
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => approveGithubStarRewardClaim(claim.id),
    onSuccess: () => {
      toast.success(t('Reward approved'))
      setApproveOpen(false)
      invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('Operation failed')
      )
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () =>
      rejectGithubStarRewardClaim(claim.id, rejectReason.trim()),
    onSuccess: () => {
      toast.success(t('Claim rejected'))
      setRejectOpen(false)
      setRejectReason('')
      invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('Operation failed')
      )
    },
  })

  const revokeMutation = useMutation({
    mutationFn: () => revokeGithubStarRewardClaim(claim.id, reason.trim()),
    onSuccess: () => {
      toast.success(t('Reward revoked'))
      setRevokeOpen(false)
      setReason('')
      invalidate()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('Operation failed')
      )
    },
  })

  const canApprove = claim.status === 'pending' || claim.status === 'rejected'

  return (
    <>
      {canApprove && (
        <Button variant='ghost' size='sm' onClick={() => setApproveOpen(true)}>
          <BadgeCheck aria-hidden='true' />
          {t('Approve')}
        </Button>
      )}
      {claim.status === 'pending' && (
        <Button
          variant='ghost'
          size='sm'
          className='text-destructive hover:text-destructive'
          onClick={() => setRejectOpen(true)}
        >
          <CircleX aria-hidden='true' />
          {t('Reject')}
        </Button>
      )}
      <DataTableRowActionMenu ariaLabel={t('Open menu')} modal={false}>
        <DropdownMenuItem
          disabled={recheckMutation.isPending}
          onClick={() => recheckMutation.mutate()}
        >
          {t('Recheck')}
          <DropdownMenuShortcut>
            {recheckMutation.isPending ? (
              <LoaderCircle size={16} className='animate-spin' />
            ) : (
              <RotateCw size={16} />
            )}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setAuditOpen(true)}>
          {t('Audit logs')}
          <DropdownMenuShortcut>
            <ClipboardList size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        {claim.status === 'granted' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='text-destructive focus:text-destructive'
              onClick={() => setRevokeOpen(true)}
            >
              {t('Revoke')}
              <DropdownMenuShortcut>
                <ShieldX size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        )}
      </DataTableRowActionMenu>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={t('Approve reward')}
        desc={t('This will grant {{quota}} to the user balance', {
          quota: formatQuota(claim.reward_quota),
        })}
        confirmText={t('Approve')}
        isLoading={approveMutation.isPending}
        handleConfirm={() => approveMutation.mutate()}
      />

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={t('Reject claim')}
        desc={t(
          'This will reject the claim. The user will not receive the reward.'
        )}
        destructive
        confirmText={t('Reject')}
        disabled={rejectReason.trim() === ''}
        isLoading={rejectMutation.isPending}
        handleConfirm={() => rejectMutation.mutate()}
      >
        <Input
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t('Enter reject reason')}
          maxLength={255}
          className='mt-3'
          aria-label={t('Enter reject reason')}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title={t('Revoke reward')}
        desc={t(
          'This will deduct {{quota}} from the user balance and mark the claim as revoked. This action cannot be undone.',
          { quota: formatQuota(claim.reward_quota) }
        )}
        destructive
        confirmText={t('Revoke')}
        disabled={reason.trim() === ''}
        isLoading={revokeMutation.isPending}
        handleConfirm={() => revokeMutation.mutate()}
      >
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('Enter revoke reason')}
          maxLength={255}
          className='mt-3'
          aria-label={t('Enter revoke reason')}
        />
      </ConfirmDialog>

      <GithubStarAuditLogsDialog
        open={auditOpen}
        onOpenChange={setAuditOpen}
        claim={claim}
      />
    </>
  )
}
