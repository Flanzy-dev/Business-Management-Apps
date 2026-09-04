import { useState } from 'react'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { productCategoryLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Input, Select } from '../ui/Input'
import { Button } from '../ui/Button'

const NEW_CATEGORY_VALUE = '__add_new__'

/**
 * The product category picker, including its inline "+ New category…" flow —
 * confirming it reuses an existing category on a case-insensitive match
 * instead of creating a near-duplicate, otherwise adds it to the shared,
 * Settings-managed list. Owns its own add-flow state; the caller only ever
 * sees the resolved category name.
 */
export function CategoryField({ category, onChange }: { category: string; onChange: (category: string) => void }) {
  const { t } = useTranslation()
  const { categories, addProductCategory } = useProductCategoryStore()
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const confirmAdd = () => {
    const name = newCategoryName.trim()
    if (!name) return
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (!existing) addProductCategory({ name })
    onChange(existing ? existing.name : name)
    setAddingCategory(false)
    setNewCategoryName('')
  }

  if (addingCategory) {
    return (
      <div className="col-span-2">
        <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('inventory.categoryLabel')}</label>
        <div className="flex gap-2">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder={t('inventory.newCategoryPlaceholder')}
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmAdd()
            }}
          />
          <Button variant="secondary" onClick={confirmAdd} disabled={!newCategoryName.trim()}>
            {t('common.add')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setAddingCategory(false)
              setNewCategoryName('')
            }}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Select
      label={t('inventory.categoryLabel')}
      value={category}
      onChange={(e) => {
        if (e.target.value === NEW_CATEGORY_VALUE) {
          setAddingCategory(true)
          setNewCategoryName('')
        } else {
          onChange(e.target.value)
        }
      }}
    >
      {categories.map((c) => (
        <option key={c.id} value={c.name}>
          {productCategoryLabel(c.name)}
        </option>
      ))}
      <option value={NEW_CATEGORY_VALUE}>{t('inventory.newCategoryOption')}</option>
    </Select>
  )
}
