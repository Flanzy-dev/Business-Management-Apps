import { describe, it, expect, beforeEach } from 'vitest'
import { useLanguageStore } from '../../store/languageStore'
import {
  isBuiltinProductCategory,
  isBuiltinServiceItemType,
  productCategoryLabel,
  serviceItemTypeLabel,
} from '../entities'

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en')
})

describe('serviceItemTypeLabel', () => {
  it('translates a built-in item type into the current language', () => {
    expect(serviceItemTypeLabel('Oli Mesin')).toBe('Engine Oil')
    useLanguageStore.getState().setLanguage('id')
    expect(serviceItemTypeLabel('Oli Mesin')).toBe('Oli Mesin')
  })

  it("shows a shop's own item type exactly as typed, in every language", () => {
    expect(serviceItemTypeLabel('Aki')).toBe('Aki')
    useLanguageStore.getState().setLanguage('id')
    expect(serviceItemTypeLabel('Aki')).toBe('Aki')
  })
})

describe('productCategoryLabel', () => {
  it('translates a built-in category into the current language', () => {
    expect(productCategoryLabel('Oil')).toBe('Oil')
    useLanguageStore.getState().setLanguage('id')
    expect(productCategoryLabel('Oil')).toBe('Oli')
  })

  it("shows a shop's own category exactly as typed", () => {
    useLanguageStore.getState().setLanguage('id')
    expect(productCategoryLabel('Ban')).toBe('Ban')
  })
})

describe('isBuiltin predicates', () => {
  it('agree with which branch the label functions take', () => {
    expect(isBuiltinServiceItemType('Oli Mesin')).toBe(true)
    expect(isBuiltinServiceItemType('Aki')).toBe(false)
    expect(isBuiltinProductCategory('Filter')).toBe(true)
    expect(isBuiltinProductCategory('Ban')).toBe(false)
  })

  it('is not fooled by inherited Object properties', () => {
    // Settings locks the rename field on a `true` here, so a category literally
    // named "constructor" must not come back as built-in.
    expect(isBuiltinServiceItemType('constructor')).toBe(false)
    expect(isBuiltinProductCategory('toString')).toBe(false)
  })
})
