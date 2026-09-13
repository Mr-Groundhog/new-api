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

import { ExternalLink } from 'lucide-react'

import type { PartnerSite } from '../types'

/** 普通合作站点卡片：Logo（缺失时以名称首字回退）+ 名称 + 简介 + 外链。 */
export function SiteCard(props: { site: PartnerSite }) {
  const site = props.site
  return (
    <a
      href={site.url}
      target='_blank'
      rel='noopener noreferrer'
      className='bg-card group hover:border-primary/40 rounded-lg border p-5 transition hover:shadow-sm focus-visible:outline-none'
    >
      <div className='flex items-start gap-3'>
        {site.logo ? (
          <img
            src={site.logo}
            alt=''
            loading='lazy'
            className='size-12 shrink-0 rounded-lg border object-cover'
          />
        ) : (
          <span className='bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold'>
            {site.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-1.5'>
            <h3 className='truncate text-sm font-semibold'>{site.name}</h3>
            <ExternalLink
              className='text-muted-foreground size-3.5 shrink-0 opacity-0 transition group-hover:opacity-100'
              aria-hidden='true'
            />
          </div>
          {site.description && (
            <p className='text-muted-foreground mt-1.5 line-clamp-2 text-sm'>
              {site.description}
            </p>
          )}
        </div>
      </div>
    </a>
  )
}
