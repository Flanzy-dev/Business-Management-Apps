import { useState } from 'react'
import { useInventoryStore, Product } from '../store/inventoryStore'
import { useSupplierStore } from '../store/supplierStore'
import { formatCurrency } from '../lib/currency'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Pencil, Trash2, PackagePlus } from 'lucide-react'

const CATEGORIES = ['Oil', 'Filter', 'Fluid', 'Parts', 'Supplies', 'Other']
const UNITS = ['each', 'quart', 'gallon', 'liter', 'case', 'box']

export default function Inventory() {
  const { products, addProduct, updateProduct, deleteProduct, adjustStock, getLowStockProducts } = useInventoryStore()
  const { suppliers } = useSupplierStore()

  const [showModal, setShowModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showLowStock, setShowLowStock] = useState(false)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('Oil')
  const [unit, setUnit] = useState('each')
  const [costPrice, setCostPrice] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [qtyOnHand, setQtyOnHand] = useState('0')
  const [reorderPoint, setReorderPoint] = useState('5')
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')

  const [adjustQty, setAdjustQty] = useState('')
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add')

  const lowStockProducts = getLowStockProducts()

  let filtered = showLowStock ? lowStockProducts : products
  filtered = filtered.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !filterCategory || p.category === filterCategory
    return matchesSearch && matchesCategory
  })

  const resetForm = () => {
    setName('')
    setSku('')
    setCategory('Oil')
    setUnit('each')
    setCostPrice('')
    setSellPrice('')
    setQtyOnHand('0')
    setReorderPoint('5')
    setSupplierId('')
    setNotes('')
    setEditing(null)
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setName(p.name)
    setSku(p.sku)
    setCategory(p.category)
    setUnit(p.unit)
    setCostPrice(p.costPrice.toString())
    setSellPrice(p.sellPrice.toString())
    setQtyOnHand(p.qtyOnHand.toString())
    setReorderPoint(p.reorderPoint.toString())
    setSupplierId(p.supplierId || '')
    setNotes(p.notes)
    setShowModal(true)
  }

  const openAdjust = (p: Product) => {
    setAdjustingProduct(p)
    setAdjustQty('')
    setAdjustType('add')
    setShowAdjustModal(true)
  }

  const handleSave = () => {
    if (!name.trim()) return alert('Name is required')
    if (!sellPrice) return alert('Sell price is required')

    const data = {
      name,
      sku,
      category,
      unit,
      costPrice: Math.round(parseFloat(costPrice || '0')),
      sellPrice: Math.round(parseFloat(sellPrice) || 0),
      qtyOnHand: parseInt(qtyOnHand) || 0,
      reorderPoint: parseInt(reorderPoint) || 0,
      supplierId: supplierId || null,
      notes,
    }

    if (editing) {
      updateProduct(editing.id, data)
    } else {
      addProduct(data)
    }
    setShowModal(false)
    resetForm()
  }

  const handleAdjust = () => {
    if (!adjustingProduct || !adjustQty) return
    const qty = parseInt(adjustQty)
    if (isNaN(qty) || qty <= 0) return alert('Enter a valid quantity')

    adjustStock(adjustingProduct.id, adjustType === 'add' ? qty : -qty)
    setShowAdjustModal(false)
    setAdjustingProduct(null)
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this product?')) {
      deleteProduct(id)
    }
  }

  const getSupplierName = (id: string | null) => {
    if (!id) return '-'
    const s = suppliers.find(x => x.id === id)
    return s?.name || '-'
  }

  const inputClass = "w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-text-primary focus:outline-none focus:border-accent-mint"

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-page-title text-text-primary">Inventory</h1>
        <button
          onClick={openCreate}
          className="bg-accent-mint text-surface-canvas px-4 py-2 rounded-tile hover:opacity-90 transition-opacity font-medium"
        >
          + Add Product
        </button>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-accent-critical-bg border-l-4 border-accent-critical p-4 mb-4 rounded-tile">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-accent-critical">Low Stock Alert:</span>
              <span className="ml-2 text-text-secondary">{lowStockProducts.length} items need reordering</span>
            </div>
            <button
              onClick={() => setShowLowStock(!showLowStock)}
              className="text-accent-critical hover:opacity-80 text-sm"
            >
              {showLowStock ? 'Show All' : 'Show Low Stock Only'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-mint"
        />
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-4 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-text-primary focus:outline-none focus:border-accent-mint"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-card rounded-card p-8 text-center text-text-secondary">
          {search || filterCategory ? 'No products found matching your filters.' : 'No products yet. Add your first one.'}
        </div>
      ) : (
        <div className="bg-surface-card rounded-card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-sunken border-b border-border-subtle">
              <tr>
                <th className="text-left p-3 font-medium text-text-secondary">Name</th>
                <th className="text-left p-3 font-medium text-text-secondary">SKU</th>
                <th className="text-left p-3 font-medium text-text-secondary">Category</th>
                <th className="text-right p-3 font-medium text-text-secondary">Cost</th>
                <th className="text-right p-3 font-medium text-text-secondary">Price</th>
                <th className="text-right p-3 font-medium text-text-secondary">Stock</th>
                <th className="text-left p-3 font-medium text-text-secondary">Supplier</th>
                <th className="text-left p-3 font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className={`border-t border-border-subtle hover:bg-surface-sunken ${p.qtyOnHand <= p.reorderPoint ? 'bg-accent-critical-bg' : ''}`}>
                  <td className="p-3 font-medium text-text-primary">{p.name}</td>
                  <td className="p-3 font-mono text-sm text-text-secondary">{p.sku || '-'}</td>
                  <td className="p-3 text-text-secondary">{p.category}</td>
                  <td className="p-3 text-right text-text-secondary tabular-nums">{formatCurrency(p.costPrice)}</td>
                  <td className="p-3 text-right font-medium text-text-primary tabular-nums">{formatCurrency(p.sellPrice)}</td>
                  <td className="p-3 text-right">
                    <span className={`tabular-nums ${p.qtyOnHand <= p.reorderPoint ? 'text-accent-critical font-bold' : 'text-text-primary'}`}>
                      {p.qtyOnHand}
                    </span>
                    <span className="text-text-secondary text-sm ml-1">{p.unit}</span>
                  </td>
                  <td className="p-3 text-sm text-text-secondary">{getSupplierName(p.supplierId)}</td>
                  <td className="p-3">
                    <DropdownMenu
                      items={[
                        { label: 'Adjust Stock', icon: PackagePlus, onClick: () => openAdjust(p) },
                        { label: 'Edit', icon: Pencil, onClick: () => openEdit(p) },
                        { label: 'Delete', icon: Trash2, onClick: () => handleDelete(p.id), variant: 'danger' },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-card p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              {editing ? 'Edit Product' : 'Add Product'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-secondary mb-1">Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Mobil 1 5W-30 Synthetic" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">SKU</label>
                  <input type="text" value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g., OIL-MOB1-5W30" className={`${inputClass} font-mono`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className={inputClass}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Unit</label>
                  <select value={unit} onChange={e => setUnit(e.target.value)} className={inputClass}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Supplier</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputClass}>
                    <option value="">No supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Cost Price (Rp)</label>
                  <input type="number" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" className={`${inputClass} tabular-nums`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Sell Price (Rp) *</label>
                  <input type="number" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="0.00" className={`${inputClass} tabular-nums`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Qty On Hand</label>
                  <input type="number" value={qtyOnHand} onChange={e => setQtyOnHand(e.target.value)} className={`${inputClass} tabular-nums`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Reorder Point</label>
                  <input type="number" value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} className={`${inputClass} tabular-nums`} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputClass} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModal(false); resetForm() }} className="flex-1 px-4 py-2 border border-border-subtle rounded-tile text-text-secondary hover:text-text-primary">
                Cancel
              </button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-accent-mint text-surface-canvas rounded-tile hover:opacity-90 font-medium">
                {editing ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdjustModal && adjustingProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-card p-6 w-full max-w-sm mx-4">
            <h2 className="text-xl font-bold text-text-primary mb-2">Adjust Stock</h2>
            <p className="text-text-primary mb-4">{adjustingProduct.name}</p>
            <p className="text-sm text-text-secondary mb-4">
              Current stock: <span className="font-bold text-text-primary">{adjustingProduct.qtyOnHand}</span> {adjustingProduct.unit}
            </p>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setAdjustType('add')}
                  className={`flex-1 py-2 rounded-tile border ${adjustType === 'add' ? 'bg-accent-mint/20 border-accent-mint text-accent-mint' : 'border-border-subtle text-text-secondary'}`}
                >
                  + Add
                </button>
                <button
                  onClick={() => setAdjustType('subtract')}
                  className={`flex-1 py-2 rounded-tile border ${adjustType === 'subtract' ? 'bg-accent-critical/20 border-accent-critical text-accent-critical' : 'border-border-subtle text-text-secondary'}`}
                >
                  - Subtract
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Quantity</label>
                <input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} min="1" className={`${inputClass} tabular-nums`} autoFocus />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdjustModal(false)} className="flex-1 px-4 py-2 border border-border-subtle rounded-tile text-text-secondary hover:text-text-primary">
                Cancel
              </button>
              <button
                onClick={handleAdjust}
                className={`flex-1 px-4 py-2 text-surface-canvas rounded-tile font-medium ${adjustType === 'add' ? 'bg-accent-mint hover:opacity-90' : 'bg-accent-critical hover:opacity-90'}`}
              >
                {adjustType === 'add' ? 'Add Stock' : 'Remove Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
