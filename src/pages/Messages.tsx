import { MessageSquare } from 'lucide-react'

export default function Messages() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-page-title text-text-primary">Messages</h1>
        <p className="text-caption">Customer communication center</p>
      </div>

      <div className="bg-surface-card rounded-card p-12 text-center">
        <MessageSquare size={48} className="mx-auto mb-4 text-text-secondary opacity-50" />
        <h2 className="text-lg font-medium text-text-primary mb-2">Coming Soon</h2>
        <p className="text-text-secondary max-w-md mx-auto">
          The messaging feature will allow you to send service reminders,
          appointment confirmations, and communicate with customers directly from the app.
        </p>
      </div>
    </div>
  )
}
