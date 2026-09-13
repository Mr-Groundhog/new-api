/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import type {
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useMediaQuery } from '@/hooks'

import { useGithubStarClaimsColumns } from './admin-claims-columns'
import { getGithubStarRewardClaims } from './api'
import { getGithubStarStatusOptions } from './constants'

// GithubStarClaimsTable 是工单管理页「Star 领取审批」Tab 的内容：分页、
// 关键字与状态筛选的领取记录表格。作为内嵌 Tab 使用本地状态而非 URL 状态。
export function GithubStarClaimsTable() {
  const { t } = useTranslation()
  const columns = useGithubStarClaimsColumns()
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
      'github-star-reward',
      'claims',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilterValue,
    ],
    queryFn: async () => {
      try {
        const result = await getGithubStarRewardClaims({
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
            : t('Failed to load GitHub Star claims')
        )
        return { items: [], total: 0 }
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const claims = data?.items || []

  const { table } = useDataTable({
    data: claims,
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

  const statusOptions = useMemo(() => getGithubStarStatusOptions(t), [t])

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No claims found')}
      emptyDescription={t(
        'No GitHub Star reward claims yet. Users can claim the reward from the personal area once they star the repository.'
      )}
      skeletonKeyPrefix='github-star-claims-skeleton'
      toolbarProps={{
        searchPlaceholder: t('Filter by GitHub login or ID...'),
        searchDebounceMs: 500,
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: statusOptions,
            singleSelect: true,
          },
        ],
      }}
    />
  )
}
