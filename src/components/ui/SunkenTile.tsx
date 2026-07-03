import { ReactNode } from 'react'

interface SunkenTileProps {
  children: ReactNode
  className?: string
}

export function SunkenTile({ children, className = '' }: SunkenTileProps) {
  return (
    <div className={`bg-surface-sunken rounded-radius-sm p-4 ${className}`}>
      {children}
    </div>
  )
}
