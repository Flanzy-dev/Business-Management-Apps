import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  caption?: string
  /** Single header action (DS Button) — one CTA per page header. */
  action?: ReactNode
}

/**
 * Standard editorial page header: h1 + optional caption on the left, at most
 * one action on the right, with a consistent mb-8 gap to the page content.
 */
export function PageHeader({ title, caption, action }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-page-title text-text-primary">{title}</h1>
        {caption && <p className="text-caption mt-1">{caption}</p>}
      </div>
      {action}
    </div>
  )
}
