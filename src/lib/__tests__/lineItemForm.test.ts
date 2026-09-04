import { describe, it, expect } from 'vitest'
import { tagFromItem, canSaveLineItem, lineItemDraftFromForm, liveIntervalForTag } from '../lineItemForm'
import { emptyServiceTag, type ServiceTagState } from '../../components/workOrders/ServiceTagFields'
import type { WorkOrderItem } from '../../store/workOrderStore'

function tag(overrides: Partial<ServiceTagState> = {}): ServiceTagState {
  return { ...emptyServiceTag, ...overrides }
}

describe('tagFromItem', () => {
  it('is the empty tag with no item, or an item with no service tag', () => {
    expect(tagFromItem()).toEqual(emptyServiceTag)
    expect(tagFromItem({ serviceItemTypeId: null } as WorkOrderItem)).toEqual(emptyServiceTag)
  })

  it('rebuilds an enabled tag from a tagged item', () => {
    const item = {
      serviceItemTypeId: 'sit-oil',
      quantityLiters: 3.5,
      serviceAction: 'topped_up',
      containerType: 'bottle',
      requestedIntervalKm: 6000,
    } as WorkOrderItem
    expect(tagFromItem(item)).toEqual({
      enabled: true,
      itemTypeId: 'sit-oil',
      quantityLiters: '3.5',
      action: 'topped_up',
      containerType: 'bottle',
      requestedIntervalKm: '6000',
    })
  })

  it('defaults action to "changed" and blanks null quantityLiters/requestedIntervalKm', () => {
    const item = { serviceItemTypeId: 'sit-oil', quantityLiters: null, serviceAction: null, containerType: null, requestedIntervalKm: null } as WorkOrderItem
    const t = tagFromItem(item)
    expect(t.action).toBe('changed')
    expect(t.quantityLiters).toBe('')
    expect(t.requestedIntervalKm).toBe('')
  })
})

describe('canSaveLineItem', () => {
  it('requires a non-blank description', () => {
    expect(canSaveLineItem('', '1')).toBe(false)
    expect(canSaveLineItem('   ', '1')).toBe(false)
  })

  it('requires a positive quantity', () => {
    expect(canSaveLineItem('Oil', '0')).toBe(false)
    expect(canSaveLineItem('Oil', 'abc')).toBe(false)
  })

  it('is true with both filled in', () => {
    expect(canSaveLineItem('Oil', '1')).toBe(true)
  })
})

describe('lineItemDraftFromForm', () => {
  it('trims the description and defaults a bad quantity to 1', () => {
    const draft = lineItemDraftFromForm('  Oil  ', 'abc', '10000', 'service', false, emptyServiceTag)
    expect(draft.description).toBe('Oil')
    expect(draft.quantity).toBe(1)
  })

  it('rounds unitPrice and defaults a bad price to 0', () => {
    expect(lineItemDraftFromForm('Oil', '1', 'abc', 'service', false, emptyServiceTag).unitPrice).toBe(0)
    expect(lineItemDraftFromForm('Oil', '1', '9999.6', 'service', false, emptyServiceTag).unitPrice).toBe(10000)
  })

  it('forces kind to product when the line is stock-linked, ignoring the picked kind', () => {
    expect(lineItemDraftFromForm('Oli', '1', '50000', 'service', true, emptyServiceTag).kind).toBe('product')
  })

  it('drops every tagged field when the tag is disabled', () => {
    const draft = lineItemDraftFromForm('Oil', '1', '50000', 'service', false, tag({ enabled: false, itemTypeId: 'sit-oil' }))
    expect(draft.serviceItemTypeId).toBeNull()
  })

  it('drops every tagged field when enabled but no item type is picked', () => {
    const draft = lineItemDraftFromForm('Oil', '1', '50000', 'service', false, tag({ enabled: true, itemTypeId: '' }))
    expect(draft.serviceItemTypeId).toBeNull()
  })

  it('carries every tagged field through when enabled with an item type', () => {
    const draft = lineItemDraftFromForm(
      'Oil',
      '1',
      '50000',
      'service',
      false,
      tag({ enabled: true, itemTypeId: 'sit-oil', quantityLiters: '3.5', action: 'changed', containerType: 'bottle', requestedIntervalKm: '6000' })
    )
    expect(draft.serviceItemTypeId).toBe('sit-oil')
    expect(draft.quantityLiters).toBe(3.5)
    expect(draft.serviceAction).toBe('changed')
    expect(draft.containerType).toBe('bottle')
    expect(draft.requestedIntervalKm).toBe(6000)
  })

  it('nulls requestedIntervalKm on a topped_up action, even if typed', () => {
    const draft = lineItemDraftFromForm(
      'Oil',
      '1',
      '50000',
      'service',
      false,
      tag({ enabled: true, itemTypeId: 'sit-oil', action: 'topped_up', requestedIntervalKm: '6000' })
    )
    expect(draft.requestedIntervalKm).toBeNull()
  })
})

describe('liveIntervalForTag', () => {
  it('is null with nothing tagged yet', () => {
    expect(liveIntervalForTag(emptyServiceTag, () => 5000)).toBeNull()
  })

  it('is null with no lookup function at all', () => {
    expect(liveIntervalForTag(tag({ itemTypeId: 'sit-oil' }))).toBeNull()
  })

  it('looks up the tagged item type once one is picked', () => {
    expect(liveIntervalForTag(tag({ itemTypeId: 'sit-oil' }), (id) => (id === 'sit-oil' ? 5000 : null))).toBe(5000)
  })
})
