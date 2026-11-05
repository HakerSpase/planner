/*
 * Запасной путь к базе. В некоторых сетях прямой адрес *.supabase.co не отвечает
 * (запрос просто висит), а сам сайт открывается. Тогда те же запросы идут через сайт:
 * /sb/… → Supabase (правило rewrites в next.config). Когда прямой адрес работает,
 * всё как обычно и лишних задержек нет.
 */

export const SUPABASE_DIRECT_URL =
	process.env.NEXT_PUBLIC_SUPABASE_URL ||
	'https://rlnqozoalmzboqypgbcq.supabase.co'

const PROXY_PATH = '/sb'
const ROUTE_KEY = 'planner-supabase-route'
const PROBE_TIMEOUT = 4000

type TypeRoute = 'direct' | 'proxy'

let route: TypeRoute | null = null
let probe: Promise<TypeRoute> | null = null

const remember = (value: TypeRoute) => {
	route = value
	try {
		if (value === 'proxy') localStorage.setItem(ROUTE_KEY, 'proxy')
		else localStorage.removeItem(ROUTE_KEY)
	} catch {}
}

async function ping(url: string, init: RequestInit, timeout = PROBE_TIMEOUT) {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeout)
	try {
		return await fetch(url, {
			cache: 'no-store',
			...init,
			signal: controller.signal
		})
	} catch {
		return null
	} finally {
		clearTimeout(timer)
	}
}

const pingDirect = async () =>
	Boolean(
		await ping(`${SUPABASE_DIRECT_URL}/auth/v1/health`, { mode: 'no-cors' })
	)

// Ответ своего сайта читается: 5xx значит, что сайт есть, а до базы он не достучался
const pingProxy = async () => {
	const response = await ping(`${PROXY_PATH}/auth/v1/health`, {}, 8000)
	return Boolean(response && response.status < 500)
}

function startProbe() {
	probe ??= pingDirect().then(ok => {
		probe = null
		remember(ok ? 'direct' : 'proxy')
		return route!
	})
	return probe
}

function initRoute() {
	if (route) return
	try {
		// В прошлый раз прямой путь не работал — сразу идём через сайт и проверяем его в фоне
		if (localStorage.getItem(ROUTE_KEY) === 'proxy') {
			route = 'proxy'
			void startProbe()
		}
	} catch {}
}

const viaProxy = (url: string) =>
	`${window.location.origin}${PROXY_PATH}${url.slice(SUPABASE_DIRECT_URL.length)}`

/** fetch для клиента Supabase: прямой адрес, а если он молчит — через сайт */
export const resilientFetch: typeof fetch = async (input, init) => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : null
	if (
		typeof window === 'undefined' ||
		!url ||
		!url.startsWith(SUPABASE_DIRECT_URL)
	)
		return fetch(input, init)

	initRoute()
	if (route === 'proxy') return fetch(viaProxy(url), init)

	const controller = new AbortController()
	const outer = init?.signal
	if (outer?.aborted) controller.abort()
	else outer?.addEventListener('abort', () => controller.abort(), { once: true })

	const direct = fetch(url, { ...init, signal: controller.signal })
	// Пока не знаем, работает ли прямой путь, — проверяем параллельно, запрос при этом не ждёт
	const switched =
		route === 'direct'
			? new Promise<never>(() => {})
			: startProbe().then(result =>
					result === 'proxy' ? ('proxy' as const) : new Promise<never>(() => {})
				)

	try {
		const result = await Promise.race([direct, switched])
		if (result !== 'proxy') return result
		direct.catch(() => {})
		controller.abort()
	} catch (error) {
		if (outer?.aborted) throw error
		remember('proxy')
	}
	return fetch(viaProxy(url), init)
}

/** Адрес базы для фоновых задач приложения: тем же путём, что работает сейчас */
export const supabaseBaseUrl = () =>
	route === 'proxy'
		? `${window.location.origin}${PROXY_PATH}`
		: SUPABASE_DIRECT_URL

/** Есть ли связь с базой хоть каким-то путём */
export async function canReachServer() {
	if (await pingDirect()) {
		remember('direct')
		return true
	}
	if (await pingProxy()) {
		remember('proxy')
		return true
	}
	return false
}

if (typeof window !== 'undefined')
	window.addEventListener('online', () => {
		route = null
	})
