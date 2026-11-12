import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  caption?: string
  /** Single header action (DS Button) — one CTA per page header. */
  action?: ReactNode
}

/**
 * Page header under the Topbar. The Topbar already shows the page's name, so
 * the h1 here is for screen readers and document structure only (visually
 * hidden, like Dashboard, Reports and Settings); what shows is the caption on
 * the left and at most one action on the right. With neither, nothing shows.
 */
export function PageHeader({ title, caption, action }: PageHeaderProps) {
  if (!caption && !action) return <h1 className="sr-only">{title}</h1>
  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="sr-only">{title}</h1>
        {caption && <p className="text-caption">{caption}</p>}
      </div>
      {action}
    </div>
  )
}
