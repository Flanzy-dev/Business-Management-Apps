import { ReactNode } from 'react'

interface TableProps {
  children: ReactNode
  className?: string
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`bg-surface-card rounded-card overflow-hidden ${className}`}>
      <table className="w-full">
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <thead className={`bg-surface-sunken border-b border-border-subtle ${className}`}>
      {children}
    </thead>
  )
}

export function TableBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <tbody className={className}>
      {children}
    </tbody>
  )
}

export function TableRow({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      className={`border-b border-border-subtle hover:bg-surface-sunken transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

interface TableHeadProps {
  children: ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
}

export function TableHead({ children, className = '', align = 'left' }: TableHeadProps) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th className={`px-4 py-3 text-sm font-semibold text-text-secondary ${alignClass} ${className}`}>
      {children}
    </th>
  )
}

interface TableCellProps {
  children: ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
  mono?: boolean
  numeric?: boolean
}

export function TableCell({ children, className = '', align = 'left', mono = false, numeric = false }: TableCellProps) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <td className={`px-4 py-3 text-text-primary ${alignClass} ${mono ? 'font-mono' : ''} ${numeric ? 'tabular-nums' : ''} ${className}`}>
      {children}
    </td>
  )
}

export function TableEmpty({ children, colSpan = 1 }: { children: ReactNode; colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-12 text-text-secondary">
        {children}
      </td>
    </tr>
  )
}
