type SearchValue = string | number | boolean | null | undefined

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000'

function getBackendBaseUrl(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/$/, '')
}

export function buildBackendUrl(path: string, searchParams?: Record<string, SearchValue>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${getBackendBaseUrl()}${normalizedPath}`)

  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  return url.toString()
}

type BackendOptions = Omit<RequestInit, 'body'> & {
  json?: unknown
  searchParams?: Record<string, SearchValue>
}

export async function backendFetch(path: string, options: BackendOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  let body: BodyInit | undefined

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.json)
  }

  return fetch(buildBackendUrl(path, options.searchParams), {
    ...options,
    headers,
    body,
    cache: options.cache ?? 'no-store',
  })
}

export async function backendJson<T = unknown>(path: string, options: BackendOptions = {}): Promise<T> {
  const response = await backendFetch(path, options)
  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = data?.detail || data?.error || response.statusText
    throw new Error(message)
  }

  return data as T
}

export async function safeBackendJson<T>(
  path: string,
  fallback: T,
  options: BackendOptions = {},
): Promise<T> {
  try {
    return await backendJson<T>(path, options)
  } catch {
    return fallback
  }
}

export async function proxyBackend(request: Request, targetPath: string): Promise<Response> {
  const url = new URL(request.url)
  const controller = new AbortController()
  // 55-секундный таймаут на сервере (меньше чем 60 сек у клиента)
  const timer = setTimeout(() => controller.abort(), 55000)

  const init: RequestInit = {
    method: request.method,
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: controller.signal,
  }

  const contentType = request.headers.get('content-type')
  if (contentType) {
    ;(init.headers as Record<string, string>)['Content-Type'] = contentType
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    const bytes = await request.arrayBuffer()
    init.body = bytes.byteLength > 0 ? bytes : undefined
  }

  try {
    const response = await fetch(
      buildBackendUrl(targetPath, Object.fromEntries(url.searchParams.entries())),
      init,
    )
    clearTimeout(timer)
    const responseText = await response.text()
    return new Response(responseText, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    })
  } catch (err) {
    clearTimeout(timer)
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    return new Response(
      JSON.stringify({ detail: isTimeout ? 'Сервер не успел ответить (таймаут)' : 'Ошибка соединения с сервером' }),
      { status: 504, headers: { 'content-type': 'application/json' } },
    )
  }
}
