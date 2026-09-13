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

import { useQuery } from '@tanstack/react-query'
import type {
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useMediaQuery } from '@/hooks'

import { getCooperationApplications } from '../api'
import { getCooperationStatusOptions } from '../constants'
import { useCooperationColumns } from './admin-columns'

/**
 * 合作申请审核表格：分页、关键字与状态筛选。
 * 使用本地状态而非 URL 状态（作为管理页 Tab 使用）。
 */
export function CooperationApplicationsTable() {
  const { t } = useTranslation()
  const columns = useCooperationColumns()
  const isMobile = useMediaQuery('(max-width: 640px)')

  const [pagination, setPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: isMobile ? 10 : 20,
  }))
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const onGlobalFilterChange: OnChangeFn<string> = (updater) => {
    setGlobalFilter((prev) =>
      typeof updater === 'function' ? updater(prev) : updater
    )
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    setColumnFilters((prev) =>
      typeof updater === 'function' ? updater(prev) : updater
    )
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const ensurePageInRange = (pageCount: number) => {
    if (pageCount > 0 && pagination.pageIndex + 1 > pageCount) {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }
  }

  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const statusFilterValue = statusFilter[0] ?? ''

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'cooperation',
      'adminList',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilterValue,
    ],
    queryFn: async () => {
      try {
        const result = await getCooperationApplications({
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
          keyword: globalFilter?.trim() || undefined,
          status: statusFilterValue || undefined,
        })
        return { items: result.items ?? [], total: result.total }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to load applications')
        )
        return { items: [], total: 0 }
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const applications = data?.items || []

  const { table } = useDataTable({
    data: applications,
    columns,
    columnFilters,
    globalFilter,
    pagination,
    onPaginationChange: setPagination,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No applications found')}
      emptyDescription={t(
        'No cooperation applications yet. Users can submit one from the personal area.'
      )}
      skeletonKeyPrefix='cooperation-applications-skeleton'
      toolbarProps={{
        searchPlaceholder: t('Filter by site name or username...'),
        searchDebounceMs: 500,
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: getCooperationStatusOptions(t),
            singleSelect: true,
          },
        ],
      }}
    />
  )
}
