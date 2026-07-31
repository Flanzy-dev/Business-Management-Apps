// The jobs almost every oil-change shop charges for, offered as a one-time
// picker so a new shop's price list isn't empty (see
// src/components/inventory/SuggestedServicesDialog.tsx). Names only for
// price — the shop enters its own, because a seeded price would put a number
// nobody agreed to onto a real ticket. Intervals ARE seeded, unlike price:
// they're real shop-supplied defaults ("whichever comes first"), not a
// number that needs confirming per item, and the shop can still adjust or
// clear either one afterward from the catalog's normal edit dialog.

export interface ServiceStarterEntry {
  /** i18n key under `inventory`; the *translated* text becomes the stored service name. */
  nameKey: string
  /**
   * Built-in ServiceItemType to link, matched by name at pick time — item type
   * ids are generated on first run, so they can't be hardcoded here. A shop
   * that renamed or deleted the type simply gets an unlinked service.
   */
  itemTypeName: string | null
  /** Default reminder interval — see ServiceCatalogItem.intervalKm/intervalMonths. */
  intervalKm?: number
  intervalMonths?: number
}

export const SERVICE_STARTER_SET: ServiceStarterEntry[] = [
  { nameKey: 'starterOilChange', itemTypeName: 'Oli Mesin', intervalKm: 5000, intervalMonths: 4 },
  { nameKey: 'starterOilFilter', itemTypeName: 'Filter Oli', intervalKm: 15000, intervalMonths: 6 },
  // Transmission oil splits by gearbox type — manual and matic wear on
  // different schedules, so one "Oli Transmisi" starter entry would always be
  // wrong for one of the two. Either can mark the same Oli Transmisi item
  // type as changed for a given vehicle.
  { nameKey: 'starterManualTransmissionOil', itemTypeName: 'Oli Transmisi', intervalKm: 15000, intervalMonths: 12 },
  { nameKey: 'starterMaticTransmissionOil', itemTypeName: 'Oli Transmisi', intervalKm: 25000, intervalMonths: 12 },
  { nameKey: 'starterDifferentialOil', itemTypeName: 'Oli Gardan', intervalKm: 15000, intervalMonths: 12 },
  { nameKey: 'starterFuelFilter', itemTypeName: 'Filter Solar', intervalKm: 15000, intervalMonths: 6 },
  { nameKey: 'starterBrakeFluid', itemTypeName: 'Minyak Rem', intervalKm: 40000, intervalMonths: 24 },
  { nameKey: 'starterPowerSteeringFluid', itemTypeName: 'Minyak Power Steering', intervalKm: 40000, intervalMonths: 24 },
  { nameKey: 'starterTuneUp', itemTypeName: null, intervalKm: 20000 },
  { nameKey: 'starterPurging', itemTypeName: null, intervalKm: 20000 },
  // Grease for large/cargo-vehicle universal joints — no matching item type
  // in the built-in schedule taxonomy, so it stays untagged like Tune Up.
  { nameKey: 'starterGrease', itemTypeName: null, intervalMonths: 4 },
  { nameKey: 'starterAlignment', itemTypeName: null },
  { nameKey: 'starterCarWash', itemTypeName: null },
  { nameKey: 'starterGeneralLabor', itemTypeName: null },
]
