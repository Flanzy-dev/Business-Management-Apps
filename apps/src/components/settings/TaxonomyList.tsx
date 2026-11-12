import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'

interface TaxonomyEntry {
  id: string
  name: string
}

/**
 * Editor for one of the shop's configurable lists (service item types, product
 * categories). Both lists mix two kinds of row:
 *
 * - **Built-in** — the app owns the name and translates it per language, so the
 *   row shows the translated label and no rename field. Renaming one would
 *   replace the stored name the translation is keyed on, silently switching the
 *   entry to that one language for everybody (see entities.ts). Delete still
 *   works, guarded by the caller's deletion policy.
 * - **Custom** — the shop's own text, editable, shown exactly as typed in every
 *   language because there's nothing to translate it to.
 */
export function TaxonomyList({
  entries,
  label,
  isBuiltin,
  onRename,
  onDelete,
  onAdd,
  addPlaceholder,
}: {
  entries: TaxonomyEntry[]
  label: (name: string) => string
  isBuiltin: (name: string) => boolean
  onRename: (id: string, name: string) => void
  /** Receives the translated label so confirm copy reads in the current language. */
  onDelete: (id: string, label: string) => void
  onAdd: (name: string) => void
  addPlaceholder: string
}) {
  const { t } = useTranslation()
  const [newName, setNewName] = useState('')

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    onAdd(name)
    setNewName('')
  }

  return (
    <>
      <div className="space-y-2 mb-4">
        {entries.map((entry) => {
          const displayName = label(entry.name)
          return (
            <div key={entry.id} className="flex items-center gap-2">
              {isBuiltin(entry.name) ? (
                <div className="flex-1 flex items-center gap-2 h-[34px]">
                  <span className="text-sm text-fg-1">{displayName}</span>
                  <Badge>{t('settings.builtinBadge')}</Badge>
                </div>
              ) : (
                <Input
                  value={entry.name}
                  onChange={(e) => onRename(entry.id, e.target.value)}
                  className="flex-1"
                />
              )}
              <IconButton label={t('common.delete')} onClick={() => onDelete(entry.id, displayName)}>
                <Trash2 size={16} />
              </IconButton>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={addPlaceholder}
          className="flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button variant="secondary" icon={Plus} onClick={handleAdd} disabled={!newName.trim()}>
          {t('common.add')}
        </Button>
      </div>
    </>
  )
}
