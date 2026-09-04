import { MouseEventHandler, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Forwarded to the underlying div — e.g. src/lib/rowInteraction.ts's
   *  rowEditOnDoubleClick, for a card that doubles as a list row. */
  onDoubleClick?: MouseEventHandler<HTMLDivElement>
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({ children, className = '', padding = 'md', onDoubleClick }: CardProps) {
  return (
    <div className={`bg-surface-card rounded-radius-md ${paddingMap[padding]} ${className}`} onDoubleClick={onDoubleClick}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`text-card-title text-text-primary ${className}`}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}
