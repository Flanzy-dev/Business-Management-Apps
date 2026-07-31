import { translate } from './i18n'

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
      error: translate('validators.vinLength', { length: cleaned.length }),
    }
  }

  // VINs cannot contain I, O, or Q
  if (/[IOQ]/.test(cleaned)) {
    return {
      valid: false,
      error: translate('validators.vinInvalidChars'),
    }
  }

  // VINs can only contain alphanumeric characters
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
    return {
      valid: false,
      error: translate('validators.vinInvalidFormat'),
    }
  }

  return { valid: true }
}

/**
 * License Plate Validation
 * Indonesian plate convention: 1-2 letter region code + 1-4 digits + 1-3
 * letter suffix (e.g. "H 1167 HA", "B 1234 XYZ") — up to ~11 characters
 * including the separating spaces.
 */
export function validateLicensePlate(plate: string): { valid: boolean; error?: string } {
  if (!plate) {
    return { valid: true } // Empty is allowed (optional field)
  }

  const cleaned = plate.toUpperCase().trim()

  if (cleaned.length < 2) {
    return {
      valid: false,
      error: translate('validators.plateTooShort'),
    }
  }

  if (cleaned.length > 11) {
    return {
      valid: false,
      error: translate('validators.plateTooLong'),
    }
  }

  // Allow alphanumeric, spaces, and hyphens
  if (!/^[A-Z0-9\s-]+$/.test(cleaned)) {
    return {
      valid: false,
      error: translate('validators.plateInvalidFormat'),
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
    .slice(0, 11)
}
