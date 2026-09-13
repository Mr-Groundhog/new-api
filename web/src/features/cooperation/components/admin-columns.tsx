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

import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { formatTimestampToDate } from '@/lib/format'

import { COOPERATION_STATUSES } from '../constants'
import type { CooperationApplication } from '../types'
import { CooperationRowActions } from './admin-row-actions'
import { CooperationMethodTags, CooperationSiteTypeLabel } from './label-bits'

// 列定义保留审核关键字段：申请人、站点、方式、状态与申请时间；
// 完整信息（简介、受众、联系方式、补充说明）通过行操作里的详情弹窗查看。
export function useCooperationColumns(): ColumnDef<CooperationApplication>[] {
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
      accessorKey: 'username',
      header: t('Applicant'),
      cell: ({ row }) => (
        <div className='min-w-0'>
          <span className='truncate text-sm font-medium'>
            {row.getValue('username')}
          </span>
          <p className='text-muted-foreground text-xs'>
            #{row.original.user_id}
          </p>
        </div>
      ),
      size: 130,
    },
    {
      accessorKey: 'site_name',
      header: t('Site'),
      cell: ({ row }) => (
        <div className='flex min-w-0 items-center gap-2.5'>
          {row.original.site_banner ? (
            <img
              src={row.original.site_banner}
              alt=''
              loading='lazy'
              className='h-9 w-16 shrink-0 rounded-md border object-cover'
            />
          ) : null}
          <div className='min-w-0'>
            <a
              href={row.original.site_url}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary truncate text-sm font-medium hover:underline'
              title={row.original.site_url}
            >
              {row.getValue('site_name')}
            </a>
            <p className='text-muted-foreground truncate text-xs'>
              {row.original.site_url}
            </p>
          </div>
        </div>
      ),
      size: 220,
    },
    {
      accessorKey: 'site_type',
      header: t('Site Type'),
      cell: ({ row }) => (
        <CooperationSiteTypeLabel
          siteType={row.getValue('site_type') as string}
        />
      ),
      size: 120,
    },
    {
      accessorKey: 'methods',
      header: t('Cooperation Methods'),
      cell: ({ row }) => (
        <CooperationMethodTags methods={row.getValue('methods') as string} />
      ),
      size: 220,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => {
        const application = row.original
        const config = COOPERATION_STATUSES[application.status]
        const reviewed = config && config.variant !== 'warning'
        return (
          <div className='min-w-0'>
            {config ? (
              <StatusBadge
                label={t(config.labelKey)}
                variant={config.variant}
                copyable={false}
                className='-ml-1.5'
              />
            ) : (
              <StatusBadge
                label={t('Unknown')}
                variant='neutral'
                copyable={false}
                className='-ml-1.5'
              />
            )}
            {reviewed && application.review_note && (
              <p
                className='text-muted-foreground mt-1 max-w-[200px] truncate text-xs'
                title={application.review_note}
              >
                {application.review_note}
              </p>
            )}
          </div>
        )
      },
      size: 150,
    },
    {
      accessorKey: 'created_time',
      header: t('Applied at'),
      cell: ({ row }) => (
        <span className='text-muted-foreground text-xs whitespace-nowrap'>
          {formatTimestampToDate(row.getValue('created_time') as number)}
        </span>
      ),
      size: 150,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <CooperationRowActions application={row.original} />,
      meta: { pinned: 'right' as const },
    },
  ]
}
