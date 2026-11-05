'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PropsWithChildren, useEffect, useState } from 'react'

export function Providers({ children }: PropsWithChildren) {
	const [client] = useState(
		new QueryClient({
			defaultOptions: {
				queries: {
					staleTime: 30_000,
					gcTime: 5 * 60_000,
					retry: 1,
					refetchOnWindowFocus: false,
					refetchOnReconnect: true
				},
				mutations: {
					retry: 0
				}
			}
		})
	)

	// Приложение ожило — запасной экран из layout больше не нужен
	useEffect(() => {
		;(window as any).__plannerBooted = true
		document.getElementById('boot-fallback')?.remove()
	}, [])

	return (
		<QueryClientProvider client={client}>
			{children}
			{process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
		</QueryClientProvider>
	)
}
