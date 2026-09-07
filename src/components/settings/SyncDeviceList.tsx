import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useDeviceStore } from '../../store/deviceStore'
import { getDeviceId } from '../../lib/deviceId'
import { resolveAuthToken } from '../../lib/sync/hostConfig'
import { fetchDevices, type DeviceActivity } from '../../lib/sync/client'
import { formatDateTime } from '../../lib/dates'
import { useTranslation } from '../../lib/i18n'
import { Input } from '../ui/Input'
import { IconButton } from '../ui/IconButton'

const POLL_INTERVAL_MS = 60_000

/**
 * Every device this shop has ever synced from, and when each last actually
 * pushed something — the two halves of "am I synced, and with what" that
 * SyncRoleSection.tsx's own "Connected to" line only answers for THIS
 * device. Names come from the synced src/store/deviceStore.ts (so renaming
 * a device here reaches every other device, including the one being
 * renamed); liveness comes from `baseUrl`'s GET /api/devices, which derives
 * it from the oplog rather than a stored heartbeat (see server/db.ts's
 * deviceActivity()).
 *
 * `baseUrl` is whatever this device is actually talking to — its own
 * embedded server when this device IS the host, or the host it follows
 * otherwise (see SyncCard.tsx's resolveBaseUrl(saved) call) — so the SAME
 * component renders a useful list from either side, exactly the shop-PC
 * and the tablet.
 */
export function SyncDeviceList({ baseUrl }: { baseUrl: string | null }) {
  const { t } = useTranslation()
  const devices = useDeviceStore((s) => s.devices)
  const renameDevice = useDeviceStore((s) => s.renameDevice)
  const removeDevice = useDeviceStore((s) => s.removeDevice)
  const [activity, setActivity] = useState<DeviceActivity[]>([])

  useEffect(() => {
    if (!baseUrl) return
    let cancelled = false

    async function poll() {
      try {
        const result = await fetchDevices(baseUrl as string, resolveAuthToken())
        if (!cancelled) setActivity(result.devices)
      } catch {
        // Silent — an unreachable host is already surfaced by the sync
        // status indicator elsewhere on this card; this list just shows
        // whatever activity it last managed to fetch.
      }
    }

    void poll()
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [baseUrl])

  if (devices.length === 0) return null

  const lastTsById = new Map(activity.map((a) => [a.device, a.lastTs]))
  const thisDeviceId = getDeviceId()
  const sorted = [...devices].sort((a, b) => (lastTsById.get(b.id) ?? '').localeCompare(lastTsById.get(a.id) ?? ''))

  return (
    <div>
      <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('sync.devicesLabel')}</p>
      <div className="space-y-1.5">
        {sorted.map((device) => {
          const lastTs = lastTsById.get(device.id)
          const isThisDevice = device.id === thisDeviceId
          return (
            <div key={device.id} className="flex items-center gap-2">
              <span
                title={lastTs ? t('sync.deviceLastActive', { time: formatDateTime(lastTs) }) : t('sync.deviceNeverSynced')}
                className={`w-2 h-2 rounded-full flex-shrink-0 ${lastTs ? 'bg-success' : 'bg-fg-4'}`}
              />
              <Input
                value={device.name}
                onChange={(e) => renameDevice(device.id, e.target.value)}
                className="flex-1"
              />
              {isThisDevice && (
                <span className="text-2xs text-fg-3 flex-shrink-0">{t('settings.thisDeviceLabel')}</span>
              )}
              <span className="text-2xs text-fg-3 w-24 flex-shrink-0 text-right truncate">
                {lastTs ? formatDateTime(lastTs) : t('sync.deviceNeverSynced')}
              </span>
              {!isThisDevice && (
                <IconButton label={t('sync.removeDeviceButton')} onClick={() => removeDevice(device.id)}>
                  <Trash2 size={16} />
                </IconButton>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
