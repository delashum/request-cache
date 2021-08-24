import {RequestSetHelpers, RequestUseHelpers} from './types'

export const RELOAD_SYMBOL = Symbol('[rcache:reload]')
export const NOOP_SYMBOL = Symbol('[rcache:noop]')
export const CACHE_EXPIRY_MS = 200

export const IDENTITY_FN = (e: any) => e
export const USE_HELPERS: RequestUseHelpers = {
  mapify: (items, param = 'id') => {
    return new Map(items.map(e => [e[param], e]))
  },
}

export const SET_HELPERS: RequestSetHelpers = {
  insert: (items, item, param = 'id') => {
    if (!item || !items) return items
    const itemIndex = items.findIndex(e => e[param] === item[param])
    if (itemIndex === -1) return [...items, item]
    else {
      const itemCopy = [...items]
      itemCopy[itemIndex] = item
      return itemCopy
    }
  },
  update: (items, id, updates, param = 'id') => {
    if (!items) return items
    const itemIndex = items.findIndex(e => e[param] === id)
    if (itemIndex === -1) return items
    else {
      const itemCopy = [...items]
      const affectedItem = items[itemIndex]
      const newItem = {...affectedItem, ...updates}
      itemCopy[itemIndex] = newItem
      return itemCopy
    }
  },
  delete: (items, id, param = 'id') => {
    if (!items) return items
    const itemIndex = items.findIndex(e => e[param] === id)
    if (itemIndex === -1) return items
    else {
      const itemCopy = [...items]
      itemCopy.splice(itemIndex, 1)
      return itemCopy
    }
  },
}
