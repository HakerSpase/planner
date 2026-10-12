'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PropsWithChildren, useState } from 'react'

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

	return (
		<QueryClientProvider client={client}>
			{children}
			{process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
		</QueryClientProvider>
	)
}
