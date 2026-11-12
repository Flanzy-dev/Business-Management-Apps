/**
 * Short discriminator appended to newly-created work-order numbers. The
 * sequential counter is intentionally device-local, so two offline devices
 * can both create SB-1042; their globally unique work-order ids make the
 * displayed references SB-1042-AB12 and SB-1042-7K9P instead.
 */
export function orderReferenceSuffix(entityId: string): string {
  const compact = entityId.replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (compact.length >= 4) return compact.slice(-4)

  // Tiny/non-standard ids are mostly test or migrated values. Hash them so
  // they still receive a fixed-width suffix without exposing punctuation.
  let hash = 2166136261
  for (let i = 0; i < entityId.length; i += 1) {
    hash ^= entityId.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4)
}

export function formatOrderNumber(orderNumber: number, deviceSuffix?: string | null): string {
  return `SB-${orderNumber}${deviceSuffix ? `-${deviceSuffix}` : ''}`
}
