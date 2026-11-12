// Which open dialog owns the keyboard. Every Dialog listens for Escape and Tab
// on `document`, so a confirm opened from inside Edit Vehicle would see the very
// keypress that dismisses it and close the form beneath too — discarding the
// edits. Dialog.tsx registers here when it opens; only the topmost answers keys.

/** Open dialogs, oldest first. */
const open: object[] = []

/** Register a dialog as the new topmost one. */
export function pushDialog(token: object): void {
  open.push(token)
}

/** Remove a dialog, wherever it sits in the stack (closes need not be LIFO). */
export function removeDialog(token: object): void {
  const at = open.indexOf(token)
  if (at !== -1) open.splice(at, 1)
}

/** True when `token` is the dialog on top, and so the one that handles keys. */
export function isTopDialog(token: object): boolean {
  return open[open.length - 1] === token
}

/** True while any dialog is open — the page stays scroll-locked until none are. */
export function hasOpenDialog(): boolean {
  return open.length > 0
}
