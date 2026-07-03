import { useState, useRef } from 'react'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Circle,
  Camera,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  X,
  Image,
} from 'lucide-react'
import {
  useInspectionStore,
  Inspection,
  InspectionItem,
  InspectionStatus,
} from '../store/inspectionStore'

interface InspectionChecklistProps {
  inspection: Inspection
  readOnly?: boolean
  onComplete?: () => void
}

const STATUS_CONFIG: Record<InspectionStatus, {
  label: string
  icon: typeof CheckCircle
  color: string
  bgColor: string
}> = {
  'pass': {
    label: 'Pass',
    icon: CheckCircle,
    color: 'text-accent-mint',
    bgColor: 'bg-accent-mint/20',
  },
  'fail': {
    label: 'Fail',
    icon: XCircle,
    color: 'text-accent-critical',
    bgColor: 'bg-accent-critical/20',
  },
  'attention': {
    label: 'Needs Attention',
    icon: AlertTriangle,
    color: 'text-accent-amber',
    bgColor: 'bg-accent-amber/20',
  },
  'not-checked': {
    label: 'Not Checked',
    icon: Circle,
    color: 'text-text-secondary',
    bgColor: 'bg-surface-sunken',
  },
}

export function InspectionChecklist({ inspection, readOnly = false, onComplete }: InspectionChecklistProps) {
  const { updateInspectionItem, completeInspection } = useInspectionStore()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Tires & Brakes', 'Fluids']))
  const [activeNoteItem, setActiveNoteItem] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<{ itemId: string; base64: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedItemForPhoto, setSelectedItemForPhoto] = useState<string | null>(null)

  // Group items by category
  const categories = inspection.items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, InspectionItem[]>)

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const handleStatusChange = (itemId: string, status: InspectionStatus) => {
    if (readOnly) return
    updateInspectionItem(inspection.id, itemId, { status })
  }

  const handleNotesChange = (itemId: string, notes: string) => {
    if (readOnly) return
    updateInspectionItem(inspection.id, itemId, { notes })
  }

  const handlePhotoCapture = (itemId: string) => {
    if (readOnly) return
    setSelectedItemForPhoto(itemId)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedItemForPhoto) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      updateInspectionItem(inspection.id, selectedItemForPhoto, { photoBase64: base64 })
      setSelectedItemForPhoto(null)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleComplete = () => {
    completeInspection(inspection.id)
    onComplete?.()
  }

  // Calculate summary stats
  const stats = {
    pass: inspection.items.filter(i => i.status === 'pass').length,
    fail: inspection.items.filter(i => i.status === 'fail').length,
    attention: inspection.items.filter(i => i.status === 'attention').length,
    notChecked: inspection.items.filter(i => i.status === 'not-checked').length,
  }

  const getCategoryStats = (items: InspectionItem[]) => {
    return {
      pass: items.filter(i => i.status === 'pass').length,
      fail: items.filter(i => i.status === 'fail').length,
      attention: items.filter(i => i.status === 'attention').length,
      total: items.length,
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="bg-surface-card rounded-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-card-title text-text-primary">Multi-Point Inspection</h3>
          {inspection.completed && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-pill bg-accent-mint/20 text-accent-mint text-xs font-medium">
              <CheckCircle size={12} />
              Completed
            </span>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="flex items-center gap-2 p-2 bg-surface-sunken rounded-tile">
            <CheckCircle size={16} className="text-accent-mint" />
            <div>
              <p className="text-lg font-semibold text-text-primary tabular-nums">{stats.pass}</p>
              <p className="text-xs text-text-secondary">Pass</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-surface-sunken rounded-tile">
            <XCircle size={16} className="text-accent-critical" />
            <div>
              <p className="text-lg font-semibold text-text-primary tabular-nums">{stats.fail}</p>
              <p className="text-xs text-text-secondary">Fail</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-surface-sunken rounded-tile">
            <AlertTriangle size={16} className="text-accent-amber" />
            <div>
              <p className="text-lg font-semibold text-text-primary tabular-nums">{stats.attention}</p>
              <p className="text-xs text-text-secondary">Attention</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-surface-sunken rounded-tile">
            <Circle size={16} className="text-text-secondary" />
            <div>
              <p className="text-lg font-semibold text-text-primary tabular-nums">{stats.notChecked}</p>
              <p className="text-xs text-text-secondary">Pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Accordions */}
      {Object.entries(categories).map(([category, items]) => {
        const isExpanded = expandedCategories.has(category)
        const categoryStats = getCategoryStats(items)

        return (
          <div key={category} className="bg-surface-card rounded-card overflow-hidden">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-sunken transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown size={18} className="text-text-secondary" />
                ) : (
                  <ChevronRight size={18} className="text-text-secondary" />
                )}
                <span className="font-medium text-text-primary">{category}</span>
              </div>

              {/* Mini Stats */}
              <div className="flex items-center gap-2">
                {categoryStats.pass > 0 && (
                  <span className="flex items-center gap-1 text-xs text-accent-mint">
                    <CheckCircle size={12} />
                    {categoryStats.pass}
                  </span>
                )}
                {categoryStats.fail > 0 && (
                  <span className="flex items-center gap-1 text-xs text-accent-critical">
                    <XCircle size={12} />
                    {categoryStats.fail}
                  </span>
                )}
                {categoryStats.attention > 0 && (
                  <span className="flex items-center gap-1 text-xs text-accent-amber">
                    <AlertTriangle size={12} />
                    {categoryStats.attention}
                  </span>
                )}
                <span className="text-xs text-text-secondary">
                  {categoryStats.pass + categoryStats.fail + categoryStats.attention}/{categoryStats.total}
                </span>
              </div>
            </button>

            {/* Category Items */}
            {isExpanded && (
              <div className="border-t border-border-subtle">
                {items.map((item, index) => {
                  const config = STATUS_CONFIG[item.status]
                  const Icon = config.icon

                  return (
                    <div
                      key={item.id}
                      className={`p-4 ${index !== items.length - 1 ? 'border-b border-border-subtle' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Icon */}
                        <div className={`w-8 h-8 rounded-tile ${config.bgColor} flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]`}>
                          <Icon size={18} className={config.color} />
                        </div>

                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary">{item.name}</p>

                          {/* Status Buttons */}
                          {!readOnly && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(['pass', 'fail', 'attention'] as InspectionStatus[]).map(status => {
                                const statusConf = STATUS_CONFIG[status]
                                const isSelected = item.status === status
                                return (
                                  <button
                                    key={status}
                                    onClick={() => handleStatusChange(item.id, status)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-tile text-xs font-medium transition-colors min-h-[44px] ${
                                      isSelected
                                        ? `${statusConf.bgColor} ${statusConf.color}`
                                        : 'bg-surface-sunken text-text-secondary hover:text-text-primary'
                                    }`}
                                  >
                                    <statusConf.icon size={14} />
                                    {statusConf.label}
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {/* Notes */}
                          {(item.notes || activeNoteItem === item.id) && (
                            <div className="mt-2">
                              {activeNoteItem === item.id && !readOnly ? (
                                <textarea
                                  autoFocus
                                  value={item.notes}
                                  onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                  onBlur={() => setActiveNoteItem(null)}
                                  placeholder="Add notes..."
                                  className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-mint resize-none"
                                  rows={2}
                                />
                              ) : item.notes ? (
                                <p className="text-xs text-text-secondary bg-surface-sunken px-2 py-1 rounded">
                                  {item.notes}
                                </p>
                              ) : null}
                            </div>
                          )}

                          {/* Photo Preview */}
                          {item.photoBase64 && (
                            <div className="mt-2">
                              <button
                                onClick={() => setPhotoPreview({ itemId: item.id, base64: item.photoBase64! })}
                                className="relative group"
                              >
                                <img
                                  src={item.photoBase64}
                                  alt={`${item.name} photo`}
                                  className="w-16 h-16 object-cover rounded-tile border border-border-subtle"
                                />
                                <div className="absolute inset-0 bg-black/50 rounded-tile opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Image size={16} className="text-white" />
                                </div>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        {!readOnly && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setActiveNoteItem(activeNoteItem === item.id ? null : item.id)}
                              className={`w-10 h-10 rounded-tile flex items-center justify-center transition-colors min-h-[44px] min-w-[44px] ${
                                item.notes
                                  ? 'bg-accent-mint/20 text-accent-mint'
                                  : 'bg-surface-sunken text-text-secondary hover:text-text-primary'
                              }`}
                              title="Add notes"
                            >
                              <MessageSquare size={16} />
                            </button>
                            <button
                              onClick={() => handlePhotoCapture(item.id)}
                              className={`w-10 h-10 rounded-tile flex items-center justify-center transition-colors min-h-[44px] min-w-[44px] ${
                                item.photoBase64
                                  ? 'bg-accent-mint/20 text-accent-mint'
                                  : 'bg-surface-sunken text-text-secondary hover:text-text-primary'
                              }`}
                              title="Add photo"
                            >
                              <Camera size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Complete Button */}
      {!readOnly && !inspection.completed && (
        <button
          onClick={handleComplete}
          disabled={stats.notChecked === inspection.items.length}
          className="w-full py-3 bg-accent-mint text-surface-canvas rounded-tile font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          Complete Inspection
        </button>
      )}

      {/* Photo Preview Modal */}
      {photoPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setPhotoPreview(null)}
          />
          <div className="relative max-w-2xl max-h-[80vh]">
            <button
              onClick={() => setPhotoPreview(null)}
              className="absolute -top-10 right-0 text-white hover:text-accent-mint"
            >
              <X size={24} />
            </button>
            <img
              src={photoPreview.base64}
              alt="Inspection photo"
              className="max-w-full max-h-[80vh] object-contain rounded-card"
            />
          </div>
        </div>
      )}
    </div>
  )
}
