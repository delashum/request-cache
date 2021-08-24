import {NOOP_SYMBOL, RELOAD_SYMBOL} from './constants'

/** HELPER TYPES */
export type GetAllValues<T> = T[keyof T]
export type GetMatchingKeys<T, S> = {[K in keyof T]: T[K] extends S ? (K extends string ? K : never) : never}[keyof T]
export type OnlyActions<T> = GetMatchingKeys<T, RequestAction<any, any>>
export type OnlyFetchers<T> = GetMatchingKeys<T, RequestCached<any, any>>
export type GetFetcherBodyType<T extends Record<string, RequestHandler>, K extends string> = T[K] extends RequestCached<
  infer B,
  any
>
  ? B
  : never
export type GetFetcherResponseType<T extends Record<string, RequestHandler>, K extends string> =
  T[K] extends RequestCached<any, infer B> ? B : never
export type GetActionBodyType<T extends Record<string, RequestHandler>, K extends string> = T[K] extends RequestAction<
  infer B,
  any
>
  ? B
  : never
export type GetActionResponseType<T extends Record<string, RequestHandler>, K extends string> =
  T[K] extends RequestAction<any, infer B> ? B : never

/** TYPES */

export type ReloadSymbol = typeof RELOAD_SYMBOL
export type NoopSymbol = typeof NOOP_SYMBOL
export type ResponseSymbols = ReloadSymbol | NoopSymbol

export type GenericCacheSetter = {
  // TODO: fix types (currently unioning all fetcher bodys)
  <T extends Record<string, RequestHandler>>(
    key: OnlyFetchers<T>,
    callback: (
      body: GetFetcherBodyType<T, OnlyFetchers<T>>,
      value: GetFetcherResponseType<T, OnlyFetchers<T>>,
      helpers: RequestSetHelpers
    ) => GetFetcherResponseType<T, OnlyFetchers<T>> | ResponseSymbols
  ): void
  RELOAD: ReloadSymbol
  NOOP: NoopSymbol
}
export type CacheSetter<B, R> = {
  (callback: (body: B, value: R, helpers: RequestSetHelpers) => R | ResponseSymbols): void
  RELOAD: ReloadSymbol
  NOOP: NoopSymbol
}

export type RequestAction<B, R> = {
  type: 'action'
  fn: (body: B, set: GenericCacheSetter) => Promise<R>
}
export type RequestCached<B, R> = {
  type: 'cached'
  fn: (body: B) => Promise<R>
  onListen?: (body: B, set: CacheSetter<B, R>) => void
}

export type InternalRequestAction = {
  fn: (body: any, set: GenericCacheSetter) => Promise<any>
}

export interface RequestCache {
  readonly resolve: Promise<any>
  readonly response: any
  readonly initialized: boolean
  readonly error: any
  setResponse: (newRes: any) => void
  registerListener: (set: (res: any) => void) => void
  deregisterListener: (set: (res: any) => void) => void
  makeRequest: (request: Promise<any>) => void
  reset: () => void
}

export type InternalRequestCached = {
  cache: Map<string, RequestCache>
  fn: (body: any) => Promise<any>
  onListen?: (body: any, set: CacheSetter<any, any>) => () => void
}

export type RequestHandler = RequestAction<any, any> | RequestCached<any, any>

export type RequestHandlerWithKey = {
  handler: RequestHandler
  key: string
}

export type RequestSetHelpers = {
  insert: <T>(items: T[], newItem: T, param?: string) => T[]
  update: <T>(items: T[], id: string, updates: Partial<T>, param?: string) => T[]
  delete: <T>(items: T[], id: string, param?: string) => T[]
}

export type RequestUseHelpers = {
  mapify: <T>(items: T[], param?: string) => Map<string, T>
}

export interface CacheContext<T extends Record<string, RequestHandler>> {
  use<K extends OnlyFetchers<T>>(key: K, body?: GetFetcherBodyType<T, K>): GetFetcherResponseType<T, K>
  use<K extends OnlyFetchers<T>, S>(
    key: K,
    body?: GetFetcherBodyType<T, K>,
    tranform?: (value: GetFetcherResponseType<T, K>, helpers: RequestUseHelpers) => S
  ): S
  do: <K extends OnlyActions<T>>(key: K, body?: GetActionBodyType<T, K>) => Promise<GetActionResponseType<T, K>>
  reload: <K extends OnlyFetchers<T>>(key: K, body?: GetFetcherBodyType<T, K>) => void
  preload: <K extends OnlyFetchers<T>>(key: K, body?: GetFetcherBodyType<T, K>) => void
}

export type CacheActions<T> = {
  reload: (key: OnlyFetchers<T>) => void
  reset: () => void
}

export type RequestCacheOptions = {
  cacheTimeout: number
}

export type CacheOptions = {
  cacheTimeout: number
  onActive: () => () => void
}


