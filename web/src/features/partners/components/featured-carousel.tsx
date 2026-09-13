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
import { useTranslation } from 'react-i18next'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

import type { PartnerSite } from '../types'

/** 重点合作站点轮播：每个站点一屏，有轮播图用图，无图用渐变背景兜底。 */
export function FeaturedCarousel(props: { sites: PartnerSite[] }) {
  const { t } = useTranslation()
  const sites = props.sites

  return (
    <Carousel opts={{ loop: sites.length > 1 }}>
      <CarouselContent>
        {sites.map((site) => (
          <CarouselItem key={site.id}>
            <a
              href={site.url}
              target='_blank'
              rel='noopener noreferrer'
              className='group block focus-visible:outline-none'
            >
              <div className='bg-card relative aspect-[21/9] w-full overflow-hidden rounded-xl border'>
                {site.banner ? (
                  <img
                    src={site.banner}
                    alt={site.name}
                    loading='lazy'
                    className='absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]'
                  />
                ) : (
                  <div
                    aria-hidden
                    className='from-primary/20 via-primary/5 absolute inset-0 bg-gradient-to-br to-transparent'
                  />
                )}
                {/* 底部渐变遮罩，保证文字在任意轮播图上可读 */}
                <div
                  aria-hidden
                  className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent'
                />
                <div className='absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-8'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-3'>
                      {site.logo ? (
                        <img
                          src={site.logo}
                          alt=''
                          loading='lazy'
                          className='bg-background size-10 shrink-0 rounded-lg border object-cover p-0.5'
                        />
                      ) : (
                        <span className='bg-background/90 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg border text-lg font-bold'>
                          {site.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <h3 className='truncate text-lg font-semibold text-white sm:text-xl'>
                        {site.name}
                      </h3>
                    </div>
                    {site.description && (
                      <p className='mt-2 line-clamp-2 max-w-2xl text-sm text-white/80'>
                        {site.description}
                      </p>
                    )}
                  </div>
                  <span className='bg-background/90 text-foreground group-hover:bg-background inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium shadow-sm transition'>
                    {t('Visit Site')}
                    <ExternalLink className='size-3.5' aria-hidden='true' />
                  </span>
                </div>
              </div>
            </a>
          </CarouselItem>
        ))}
      </CarouselContent>
      {sites.length > 1 && (
        <>
          <CarouselPrevious className='left-4 z-10' />
          <CarouselNext className='right-4 z-10' />
        </>
      )}
    </Carousel>
  )
}
