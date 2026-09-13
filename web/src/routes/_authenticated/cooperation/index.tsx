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

import { createFileRoute, redirect } from '@tanstack/react-router'

import { CooperationPromotion } from '@/features/cooperation'
import { isSidebarModuleEnabledDefaultClosed } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/cooperation/')({
  beforeLoad: () => {
    // 与服务端提交 gate 同源的管理员级模块开关；合作推广默认关闭，
    // 未显式开启时整页不可达
    if (!isSidebarModuleEnabledDefaultClosed('personal', 'cooperation')) {
      throw redirect({ to: '/' })
    }
  },
  component: CooperationPromotion,
})
