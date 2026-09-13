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
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  COOPERATION_METHOD_KEYS,
  COOPERATION_METHOD_LIMITS,
  COOPERATION_METHODS,
  getCooperationMethodOptions,
} from '../../cooperation/constants'

/** 设置表单里的单个条目：id 不可编辑（内置保留原 id，自定义自动生成），label 可改名 */
type MethodEntry = {
  id: string
  label: string
  /** 内置方式：label 留空沿用默认翻译 */
  builtin: boolean
}

type CooperationMethodsFormValues = {
  entries: MethodEntry[]
}

type CooperationMethodsSectionProps = {
  /** 后端 CooperationMethodsAdmin 选项原始值（JSON 数组字符串，空 = 默认全集） */
  initialSerialized: string
}

const toDefaultEntries = (): MethodEntry[] =>
  COOPERATION_METHOD_KEYS.map((key) => ({
    id: key,
    label: '',
    builtin: true,
  }))

/** 解析选项为可编辑条目；与 getCooperationMethodOptions 的回落一致 */
function parseToEntries(raw: string): MethodEntry[] {
  const options = getCooperationMethodOptions(raw)
  return options.map((option) => ({
    id: option.id,
    label: option.label ?? '',
    builtin: COOPERATION_METHOD_KEYS.includes(
      option.id as (typeof COOPERATION_METHOD_KEYS)[number]
    ),
  }))
}

/** 与内置全集语义相同（id 一致且均未重命名）时保存为空串，空串即默认 */
function serializeEntries(entries: MethodEntry[]): string {
  const isDefault =
    entries.length === COOPERATION_METHOD_KEYS.length &&
    entries.every(
      (entry, index) =>
        entry.id === COOPERATION_METHOD_KEYS[index] && entry.label === ''
    )
  if (isDefault) return ''
  return JSON.stringify(
    entries.map((entry) =>
      entry.label === '' ? { id: entry.id } : { id: entry.id, label: entry.label }
    )
  )
}

const generateCustomId = () =>
  `custom_${Math.random().toString(36).slice(2, 8)}`

/**
 * 「合作方式」配置：管理员维护开放给用户的合作方式清单——可删除不需要的
 * 内置方式、重命名、新增自定义方式；保存为 CooperationMethodsAdmin 选项。
 */
export function CooperationMethodsSection({
  initialSerialized,
}: CooperationMethodsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const defaults = useMemo<CooperationMethodsFormValues>(
    () => ({ entries: parseToEntries(initialSerialized) }),
    [initialSerialized]
  )
  const { watch, reset, setValue } = useForm<CooperationMethodsFormValues>({
    defaultValues: defaults,
  })
  useEffect(() => {
    reset(defaults)
  }, [defaults, reset])
  const entries = watch('entries')

  const [error, setError] = useState<string | null>(null)

  const validate = (values: CooperationMethodsFormValues): string | null => {
    if (values.entries.length === 0) {
      return t('At least one cooperation method is required')
    }
    for (const entry of values.entries) {
      if (!entry.builtin && entry.label.trim() === '') {
        return t('Custom cooperation methods require a name')
      }
      if (
        [...entry.label.trim()].length >
        COOPERATION_METHOD_LIMITS.MAX_LABEL_LENGTH
      ) {
        return t('Method names cannot exceed {{max}} characters', {
          max: COOPERATION_METHOD_LIMITS.MAX_LABEL_LENGTH,
        })
      }
    }
    return null
  }

  const onSubmit = async (values: CooperationMethodsFormValues) => {
    const validationError = validate(values)
    setError(validationError)
    if (validationError) return

    const serialized = serializeEntries(values.entries)
    if (serialized === initialSerialized) return
    await updateOption.mutateAsync({
      key: 'CooperationMethodsAdmin',
      value: serialized,
    })
  }

  const addEntry = () => {
    if (entries.length >= COOPERATION_METHOD_LIMITS.MAX_METHODS) return
    setValue('entries', [...entries, { id: generateCustomId(), label: '', builtin: false }], {
      shouldDirty: true,
    })
  }

  const removeEntry = (id: string) => {
    setValue(
      'entries',
      entries.filter((entry) => entry.id !== id),
      { shouldDirty: true }
    )
  }

  const updateLabel = (id: string, label: string) => {
    setValue(
      'entries',
      entries.map((entry) => (entry.id === id ? { ...entry, label } : entry)),
      { shouldDirty: true }
    )
  }

  const resetToDefault = () => {
    setError(null)
    reset({ entries: toDefaultEntries() })
  }

  return (
    <SettingsSection title={t('Cooperation Methods')}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit({ entries })
        }}
      >
        <SettingsForm>
          <SettingsPageFormActions
            onSave={() => void onSubmit({ entries })}
            onReset={resetToDefault}
            isSaving={updateOption.isPending}
            resetLabel='Reset to default'
            saveLabel='Save cooperation methods'
          />
          <p className='text-muted-foreground text-sm'>
            {t(
              'Choose the cooperation methods offered to applicants. Remove the ones you do not offer, rename them, or add your own.'
            )}
          </p>
          <div className='flex flex-col gap-2'>
            {entries.map((entry) => {
              const builtinConfig =
                COOPERATION_METHODS[entry.id as keyof typeof COOPERATION_METHODS]
              const placeholder = entry.builtin
                ? t(builtinConfig?.labelKey ?? entry.id)
                : t('Custom method name')
              return (
                <div key={entry.id} className='flex items-center gap-2'>
                  <Input
                    value={entry.label}
                    onChange={(event) => updateLabel(entry.id, event.target.value)}
                    placeholder={placeholder}
                    maxLength={COOPERATION_METHOD_LIMITS.MAX_LABEL_LENGTH}
                    aria-label={
                      entry.builtin
                        ? t('Rename "{{name}}"', { name: placeholder })
                        : t('Custom method name')
                    }
                    className={cn(
                      !entry.builtin &&
                        entry.label.trim() === '' &&
                        'border-destructive/50'
                    )}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    aria-label={t('Remove method "{{name}}"', {
                      name: entry.label.trim() || placeholder,
                    })}
                    onClick={() => removeEntry(entry.id)}
                  >
                    <Trash2 aria-hidden='true' />
                  </Button>
                </div>
              )
            })}
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={addEntry}
            disabled={entries.length >= COOPERATION_METHOD_LIMITS.MAX_METHODS}
          >
            <Plus aria-hidden='true' />
            {t('Add method')}
          </Button>
          {error && <p className='text-destructive text-sm'>{error}</p>}
        </SettingsForm>
      </form>
    </SettingsSection>
  )
}
