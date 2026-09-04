// Translation lookup + interpolation. `en`/`id` are flat-ish nested
// dictionaries (see en.ts, id.ts); keys are dot-paths like 'nav.dashboard'.
import { useCallback, useMemo } from 'react'
import { useLanguageStore, Language } from '../../store/languageStore'
import { en } from './en'
import { id } from './id'

const dictionaries: Record<Language, unknown> = { en, id }

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''))
}

function lookup(language: Language, path: string): string | undefined {
  const parts = path.split('.')
  let node: unknown = dictionaries[language]
  for (const part of parts) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

/**
 * Pure accessor for non-component code (deletionPolicy.ts, validators.ts,
 * printReceipt's imperative HTML builder) — reads the current language via
 * useLanguageStore.getState(), matching the existing imperative-store-access
 * convention already used elsewhere (e.g. Receipt.tsx's
 * useToastStore.getState()). Falls back English -> raw key, so a missing or
 * mistyped key never renders blank.
 */
export function translate(path: string, vars?: Record<string, string | number>): string {
  const language = useLanguageStore.getState().language
  const text = lookup(language, path) ?? lookup('en', path) ?? path
  return interpolate(text, vars)
}

/** Selects `${path}_one` when count===1, else `${path}_other`, injecting `count` into vars. */
export function translateCount(path: string, count: number, vars?: Record<string, string | number>): string {
  return translate(`${path}_${count === 1 ? 'one' : 'other'}`, { count, ...vars })
}

/** Hook for components — re-renders when the language changes. */
export function useTranslation() {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  // translate()/translateCount() read the active language from
  // useLanguageStore.getState() themselves, and this hook already subscribes
  // to `language`, so keying these on it is both correct and complete — and
  // it gives `t`/`tc` a STABLE identity between renders. Without that, every
  // `useMemo(fn, [..., t])` in a page (Dashboard's repeatData /
  // technicianQueueData, Reports' customersData) silently never cached,
  // because `t` was a brand-new closure on every render.
  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => translate(path, vars),
    [language],
  )
  const tc = useCallback(
    (path: string, count: number, vars?: Record<string, string | number>) => translateCount(path, count, vars),
    [language],
  )
  return useMemo(() => ({ language, setLanguage, t, tc }), [language, setLanguage, t, tc])
}
