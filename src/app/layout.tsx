import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'

import { SITE_NAME } from '@/constants/seo.constants'

import './globals.scss'
import { Providers } from './providers'

const sans = Inter({
	subsets: ['cyrillic', 'latin'],
	display: 'swap',
	variable: '--font-sans'
})

const mono = JetBrains_Mono({
	subsets: ['cyrillic', 'latin'],
	display: 'swap',
	variable: '--font-mono'
})

export const metadata: Metadata = {
	title: {
		default: SITE_NAME,
		template: `%s | ${SITE_NAME}`
	},
	description: 'Современный планировщик задач, таймер Pomodoro и тайм-блокинг',
	icons: {
		icon: '/planner-icon.svg',
		apple: '/planner-icon-192.png'
	}
}

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html
			lang='ru'
			className={`${sans.variable} ${mono.variable}`}
		>
			<body className='font-sans'>
				<Providers>
					{children}

					<Toaster
						theme='dark'
						position='bottom-right'
						duration={1800}
						toastOptions={{
							className:
								'!bg-elevated !border-border !text-fg !rounded-xl !font-sans'
						}}
					/>
				</Providers>
			</body>
		</html>
	)
}
