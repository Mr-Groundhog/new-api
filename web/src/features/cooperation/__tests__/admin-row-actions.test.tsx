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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { CooperationRowActions } from '../components/admin-row-actions'
import { COOPERATION_STATUS, type CooperationApplication } from '../types'

const approvedApplication: CooperationApplication = {
  id: 7,
  user_id: 1,
  username: 'alice',
  site_name: '一梦五千年',
  site_url: 'https://example.com',
  site_banner: 'https://cdn.example.com/banner.png',
  site_type: 'blog',
  description: '一个关于 AI 的技术博客',
  audience: '日活约 1000',
  methods: '["token"]',
  contact: 'admin@example.com',
  notes: '',
  status: COOPERATION_STATUS.APPROVED,
  review_note: '',
  reviewer_id: 0,
  review_time: 0,
  created_time: 100,
  updated_time: 100,
}

const pendingApplication: CooperationApplication = {
  ...approvedApplication,
  id: 8,
  status: COOPERATION_STATUS.PENDING,
}

function renderRowActions(application: CooperationApplication) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <CooperationRowActions application={application} />
    </QueryClientProvider>
  )
}

async function openMenu() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Open menu' }))
}

describe('cooperation admin row actions showcase flow', () => {
  // 已通过申请可一键预填「合作站点」表单；待审核申请不显示该入口
  test('approved application opens prefilled site form from the menu', async () => {
    renderRowActions(approvedApplication)
    await openMenu()

    const menuItem = screen.getByRole('menuitem', {
      name: /Add to partner sites/,
    })
    await userEvent.setup().click(menuItem)

    // 新建模式标题 + 申请数据预填
    expect(screen.getByText('Add Site')).toBeInTheDocument()
    expect(
      (screen.getByLabelText('Site Name') as HTMLInputElement).value
    ).toBe('一梦五千年')
    expect(
      (screen.getByLabelText('Site URL') as HTMLInputElement).value
    ).toBe('https://example.com')
    expect(
      (screen.getByLabelText('Banner URL') as HTMLInputElement).value
    ).toBe('https://cdn.example.com/banner.png')
  })

  test('pending application has no showcase menu item', async () => {
    renderRowActions(pendingApplication)
    await openMenu()

    expect(
      screen.queryByRole('menuitem', { name: /Add to partner sites/ })
    ).not.toBeInTheDocument()
  })
})
