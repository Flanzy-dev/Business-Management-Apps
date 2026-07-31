/**
 * VIN Validation
 * Standard VIN is 17 characters, excludes I, O, Q
 */
export function validateVIN(vin: string): { valid: boolean; error?: string } {
  if (!vin) {
    return { valid: true } // Empty is allowed (optional field)
  }

  const cleaned = vin.toUpperCase().trim()

  if (cleaned.length !== 17) {
    return {
      valid: false,
      error: `VIN must be 17 characters (currently ${cleaned.length})`,
    }
  }

  // VINs cannot contain I, O, or Q
  if (/[IOQ]/.test(cleaned)) {
    return {
      valid: false,
      error: 'VIN cannot contain letters I, O, or Q',
    }
  }

  // VINs can only contain alphanumeric characters
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
    return {
      valid: false,
      error: 'VIN can only contain letters (except I, O, Q) and numbers',
    }
  }

  return { valid: true }
}

/**
 * License Plate Validation
 * Basic validation - alphanumeric, 2-8 characters
 */
export function validateLicensePlate(plate: string): { valid: boolean; error?: string } {
  if (!plate) {
    return { valid: true } // Empty is allowed (optional field)
  }

  const cleaned = plate.toUpperCase().trim()

  if (cleaned.length < 2) {
    return {
      valid: false,
      error: 'License plate must be at least 2 characters',
    }
  }

  if (cleaned.length > 8) {
    return {
      valid: false,
      error: 'License plate cannot exceed 8 characters',
    }
  }

  // Allow alphanumeric, spaces, and hyphens
  if (!/^[A-Z0-9\s-]+$/.test(cleaned)) {
    return {
      valid: false,
      error: 'License plate can only contain letters, numbers, spaces, and hyphens',
    }
  }

  return { valid: true }
}

/**
 * Format VIN as user types (uppercase, no invalid chars)
 */
export function formatVIN(input: string): string {
  return input
    .toUpperCase()
    .replace(/[IOQ]/g, '') // Remove invalid characters
    .replace(/[^A-HJ-NPR-Z0-9]/g, '') // Only allow valid VIN characters
    .slice(0, 17)
}

/**
 * Format license plate as user types (uppercase)
 */
export function formatLicensePlate(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '') // Only allow valid plate characters
    .slice(0, 8)
}
