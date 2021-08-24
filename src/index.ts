import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {CACHE_EXPIRY_MS, IDENTITY_FN, NOOP_SYMBOL, RELOAD_SYMBOL, SET_HELPERS, USE_HELPERS} from './constants'
import {
  CacheActions,
  CacheContext,
  CacheOptions,
  CacheSetter,
  GenericCacheSetter,
  InternalRequestAction,
  InternalRequestCached,
  RequestAction,
  RequestCache,
  RequestCached,
  RequestCacheOptions,
  RequestHandler,
  RequestHandlerWithKey,
  RequestUseHelpers,
} from './types'

/** PUBLIC */

export const action = <B, R>(fn: RequestAction<B, R>['fn']): RequestAction<B, R> => ({
  type: 'action',
  fn,
})
export const cached = <B, R>(
  fn: RequestCached<B, R>['fn'],
  onListen?: RequestCached<B, R>['onListen']
): RequestCached<B, R> => ({
  type: 'cached',
  fn,
  onListen,
})

export const createRequestCache = <T extends Record<string, RequestHandler>>(
  handlers: T,
  {cacheTimeout = CACHE_EXPIRY_MS}: Partial<RequestCacheOptions> = {}
) => {
  const handlerKeys = Object.keys(handlers)
  const handlerArray: RequestHandlerWithKey[] = handlerKeys.map(key => ({handler: handlers[key], key}))
  const actionHandlers: {handler: InternalRequestAction; key: string}[] = handlerArray
    .filter(({handler}) => handler.type === 'action')
    .map(({handler, key}) => ({handler: {fn: handler.fn}, key}))
  const cachedHandlers: {handler: InternalRequestCached; key: string}[] = handlerArray
    .filter(({handler}) => handler.type === 'cached')
    .map(({handler, key}: any) => ({handler: {fn: handler.fn, onListen: handler.onListen, cache: new Map()}, key}))

  const actionMap = new Map<string, InternalRequestAction>(actionHandlers.map(({key, handler}) => [key, handler]))
  const cachedMap = new Map<string, InternalRequestCached>(cachedHandlers.map(({key, handler}) => [key, handler]))

  const doSetter: GenericCacheSetter = (key, callback) => {
    if (!cachedMap.has(key as string)) console.warn(`'${key}' is not a valid state to set`)
    const request = cachedMap.get(key as string)
    for (const [bodyStr, {response, initialized}] of request.cache) {
      if (!initialized) continue
      const body = unstringifyBody(bodyStr)
      const newRes = callback(body, response, SET_HELPERS)
      if (newRes === NOOP_SYMBOL) continue
      const cacheEntry = request.cache.get(bodyStr)
      if (newRes === RELOAD_SYMBOL) cacheEntry.makeRequest(request.fn(body))
      else cacheEntry.setResponse(newRes)
    }
  }

  doSetter.RELOAD = RELOAD_SYMBOL
  doSetter.NOOP = NOOP_SYMBOL

  const getSpecificSetter = (key: string) => {
    const request = cachedMap.get(key)
    const specificSetter: CacheSetter<any, any> = callback => {
      for (const [bodyStr, {response, initialized}] of request.cache) {
        if (!initialized) continue
        const body = unstringifyBody(bodyStr)
        const newRes = callback(body, response, SET_HELPERS)
        if (newRes === NOOP_SYMBOL) continue
        const cacheEntry = request.cache.get(bodyStr)
        if (newRes === RELOAD_SYMBOL) cacheEntry.makeRequest(request.fn(body))
        else if (newRes !== response) cacheEntry.setResponse(newRes)
      }
    }
    specificSetter.RELOAD = RELOAD_SYMBOL
    specificSetter.NOOP = NOOP_SYMBOL
    return specificSetter
  }

  const ensureBodyCache = (req: InternalRequestCached, bodyKey: string, key: string) => {
    const newCacheEntry = newRequestCache({
      cacheTimeout,
      onActive: () => req?.onListen(unstringifyBody(bodyKey), getSpecificSetter(key)),
    })
    req.cache.set(bodyKey, newCacheEntry)
    return newCacheEntry
  }

  const context: CacheContext<T> = {
    use: (key: string, body?: any, transform?: (v: any, h: RequestUseHelpers) => any) => {
      transform ??= IDENTITY_FN
      body ??= {}
      if (!cachedMap.has(key as string)) return console.warn(`'${key}' is not a valid request`)
      const [_, setError] = useState()
      const request = cachedMap.get(key as string)
      const bodyKey = stringifyBody(body)
      let cacheEntry = request.cache.get(bodyKey)
      const [response, setResponse] = useState(() =>
        cacheEntry && cacheEntry.initialized && !cacheEntry.error
          ? transform(cacheEntry.response, USE_HELPERS)
          : undefined
      )
      const setResWithTransform = useCallback((value: any) => {
        setResponse(transform(value, USE_HELPERS))
      }, [])

      if (!request.cache.has(bodyKey)) cacheEntry = ensureBodyCache(request, bodyKey, key)
      if (!cacheEntry.initialized && !cacheEntry.resolve) cacheEntry.makeRequest(request.fn(body))
      if (cacheEntry.error)
        setError(() => {
          throw cacheEntry.error
        })
      if (cacheEntry.resolve && !cacheEntry.initialized) throw cacheEntry.resolve

      useEffect(() => {
        cacheEntry.registerListener(setResWithTransform)
        return () => cacheEntry.deregisterListener(setResWithTransform)
      }, [cacheEntry])

      return response
    },
    do: async (key, body) => {
      body ??= {} as any
      if (!actionMap.has(key as string)) return console.warn(`'${key}' is not a valid action`)
      const action = actionMap.get(key as string)
      return action.fn(body, doSetter)
    },
    reload: (key, body) => {
      body ??= {} as any
      if (!cachedMap.has(key as string)) return console.warn(`'${key}' is not a valid request`)
      const cacheEntry = cachedMap.get(key)
      const bodyKey = stringifyBody(body)
      const request = cacheEntry.cache.get(bodyKey)
      request.makeRequest(cacheEntry.fn(body))
    },
    preload: (key, body) => {
      body ??= {} as any
      if (!cachedMap.has(key as string)) return console.warn(`'${key}' is not a valid request`)
      const request = cachedMap.get(key as string)
      const bodyKey = stringifyBody(body)
      if (!request.cache.has(bodyKey)) {
        const newCacheEntry = ensureBodyCache(request, bodyKey, key)
        newCacheEntry.makeRequest(request.fn(body))
      }
    },
  }

  const actions: CacheActions<T> = {
    reload: key => {
      if (!cachedMap.has(key as string)) return console.warn(`'${key}' is not a valid request`)
      const request = cachedMap.get(key)
      for (const [bodyKey, {makeRequest}] of request.cache) makeRequest(request.fn(unstringifyBody(bodyKey)))
    },
    reset: () => {
      for (const [_, request] of cachedMap) {
        for (const [__, {reset}] of request.cache) reset()
        request.cache = new Map()
      }
    },
  }

  return [context, actions, {} as typeof handlers] as const
}

/** PRIVATE */

const stringifyBody = (body: any) => {
  return JSON.stringify(body)
}

const unstringifyBody = (body: any) => {
  if (typeof body !== 'string') return body
  return JSON.parse(body)
}

const newRequestCache = ({cacheTimeout, onActive}: CacheOptions): RequestCache => {
  let currentResponse = null
  let resolver = null
  let _init = false
  let _active = false
  let activeCleanup: () => void
  let cacheInvalidationTimer: any
  const setters = new Set<(value: any) => void>()
  let _error: any

  const _reset = () => {
    _init = false
    _active = false
    _error = undefined
    for (const fn of setters) fn(undefined)
    activeCleanup?.()
    activeCleanup = null
  }

  return {
    get response() {
      return currentResponse
    },
    get initialized() {
      return _init
    },
    get resolve() {
      return resolver
    },
    get error() {
      return _error
    },
    setResponse: newRes => {
      currentResponse = newRes
      for (const fn of setters) fn(newRes)
    },
    makeRequest: req => {
      resolver = req
        .then(res => {
          currentResponse = res
          _init = true
          resolver = null
          for (const fn of setters) fn(res)
        })
        .catch(err => {
          _init = true
          _error = err
        })
    },
    registerListener: setter => {
      clearTimeout(cacheInvalidationTimer)
      if (_active === false) activeCleanup = onActive()
      setters.add(setter)
      _active = true
    },
    deregisterListener: setter => {
      setters.delete(setter)
      if (setters.size === 0) {
        cacheInvalidationTimer = setTimeout(_reset, cacheTimeout)
      }
    },
    reset: _reset,
  }
}
