import { useCallback, useState } from 'react'
import { useTranslation } from '../lib/i18n'

/**
 * Required-field handling for a form dialog, in the app's own language.
 *
 * The browser's native `required` bubble is worded in the browser's locale,
 * not the app's Indonesian/English setting, and a submit path that isn't a
 * real `<button type="submit">` (e.g. "Save & add vehicle") skips it entirely
 * and just does nothing. This replaces both: `validate` marks every blank
 * required field with an inline message (the `error` prop of `Input`, which
 * also sets `aria-invalid` and announces it), then moves focus to the first
 * one. Don't put the HTML `required` attribute on the field (use
 * `aria-required="true"`) and don't add `noValidate` to the form: without
 * `required` the browser lets a blank submit through to `validate`, while its
 * format checks (`type="email"`, ...) keep working.
 *
 * Usage:
 *   const { errors, validate, clear } = useRequiredFields<'name'>()
 *   if (!validate({ name })) return
 *   <Input error={errors.name} onChange={(e) => { setName(e.target.value); clear('name') }} />
 */
export function useRequiredFields<K extends string>() {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({})

  /** Shows these messages inline (replacing any others) and moves focus to
   *  the first flagged field. For a form whose own validator (a plain .ts
   *  module) already decided what is wrong; returns true when nothing was
   *  flagged, so `if (!flag(...)) return` reads like `validate`. */
  const flag = useCallback((messages: Partial<Record<K, string | false>>): boolean => {
    const next: Partial<Record<K, string>> = {}
    for (const key of Object.keys(messages) as K[]) {
      const message = messages[key]
      if (typeof message === 'string' && message) next[key] = message
    }
    setErrors(next)
    const invalid = Object.keys(next).length > 0
    if (invalid) {
      // After React has committed the aria-invalid attributes. Two queries,
      // not one selector list: a list returns the first match in document
      // order, so a flagged field on the page *behind* the dialog would win.
      requestAnimationFrame(() => {
        const target =
          document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]') ??
          document.querySelector<HTMLElement>('[aria-invalid="true"]')
        target?.focus()
      })
    }
    return !invalid
  }, [])

  /** True when every required value is non-blank. Otherwise sets the
   *  messages, focuses the first invalid field, and returns false. */
  const validate = useCallback(
    (values: Record<K, string>): boolean => {
      const messages: Partial<Record<K, string | false>> = {}
      for (const key of Object.keys(values) as K[]) {
        messages[key] = !values[key].trim() && t('common.requiredField')
      }
      return flag(messages)
    },
    [t, flag]
  )

  /** Clears every message, e.g. when a dialog that stays mounted reopens. */
  const reset = useCallback(() => setErrors({}), [])

  /** Drop one field's message as soon as the user edits it. */
  const clear = useCallback((key: K) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _removed, ...rest } = prev
      return rest as Partial<Record<K, string>>
    })
  }, [])

  return { errors, validate, flag, clear, reset }
}
