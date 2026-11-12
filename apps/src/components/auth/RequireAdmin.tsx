// Wraps every admin-only route in src/App.tsx as a pathless layout route.
// Declarative and pre-mount: <Navigate> replaces the child before it's ever
// created, so a worker hitting a restricted URL (direct hash entry,
// browser back/forward, a stray Link) never gets a frame of the real page
// painted first. `replace` keeps the restricted URL out of history.
import { Navigate, Outlet } from 'react-router-dom'
import { useIsAdmin } from '../../store/authStore'

export default function RequireAdmin() {
  const isAdmin = useIsAdmin()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}
