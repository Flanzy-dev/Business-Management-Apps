// The version this renderer bundle was built from — see vite.config.ts's
// `define`, which reads it straight out of package.json. For an Electron
// install this always equals app.getVersion(), since both are produced by
// the same build from the same package.json; for a LAN browser tab it is
// the version of whatever host served this bundle, which is exactly what
// should be displayed (see src/lib/update/updateBridge.ts's canAutoUpdate
// doc for why a tab can never itself be "out of date").
//
// Used for on-screen display (sidebar footer, Settings About card, Profile)
// via {{version}} interpolation — see src/lib/i18n's en.ts/id.ts. NOT used
// for the update-check handshake or the update log: those go through
// app.getVersion() over IPC instead (electron/main.ts), because they must
// reflect the actual installed binary, not the bundle Vite happened to
// stamp at build time — the two are supposed to always agree, but the
// update path is exactly the code whose job is to notice if they ever
// don't.
export const APP_VERSION: string = __APP_VERSION__

/** "v1.1.4" — the app version with its conventional display prefix. */
export function versionLabel(version: string = APP_VERSION): string {
  return `v${version}`
}
