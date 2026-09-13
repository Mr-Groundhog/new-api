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

import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { CooperationApplicationsTable } from './components/admin-applications-table'
import { CooperationSitesTable } from './components/admin-sites'

/**
 * 管理端「合作推广」页：申请审核 + 合作站点（「合作站点」公共页面数据源）
 * 两个 Tab。
 */
export function CooperationManagement() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {t('Cooperation & Promotion')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 flex-col gap-4'>
          <Tabs
            defaultValue='applications'
            className='flex min-h-0 flex-1 flex-col'
          >
            <div className='shrink-0 pb-3'>
              <TabsList>
                <TabsTrigger value='applications'>
                  {t('Applications')}
                </TabsTrigger>
                <TabsTrigger value='sites'>{t('Partner Sites')}</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value='applications' className='min-h-0 flex-1'>
              <CooperationApplicationsTable />
            </TabsContent>
            <TabsContent value='sites' className='min-h-0 flex-1'>
              <CooperationSitesTable />
            </TabsContent>
          </Tabs>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
