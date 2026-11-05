import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Unbounded } from 'next/font/google'
import { Toaster } from 'sonner'

import { SITE_NAME } from '@/constants/seo.constants'

import './globals.scss'
import { Providers } from './providers'

const sans = Inter({
	subsets: ['cyrillic', 'latin'],
	display: 'swap',
	variable: '--font-sans'
})

// Только для логотипа «Planner»
const display = Unbounded({
	subsets: ['latin'],
	weight: ['500', '600'],
	display: 'swap',
	variable: '--font-display'
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

// Установленное приложение на телефоне — на весь экран: фон уходит под строку состояния
// и жестовую панель, а отступы под них даёт env(safe-area-inset-*)
export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover',
	themeColor: '#09090b',
	colorScheme: 'dark'
}

const BOOT_FALLBACK = `setTimeout(function(){
if(window.__plannerBooted)return;
var d=document.createElement('div');d.id='boot-fallback';
d.style.cssText='position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#09090b;color:#e8e8ee;font:15px/1.6 system-ui,sans-serif;text-align:center;padding:24px';
d.innerHTML='<div style="max-width:340px"><h1 style="font-size:20px;font-weight:600;margin:0 0 8px">Planner долго загружается</h1><p style="margin:0 0 20px;color:#9a9aa8">Похоже, неполадки с сетью. Проверьте интернет и обновите страницу.</p><button onclick="location.reload()" style="height:48px;width:100%;border:0;background:#7c5cff;color:#fff;font:inherit;font-weight:500;cursor:pointer">Обновить</button></div>';
document.documentElement.appendChild(d)},15000)`

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html
			lang='ru'
			className={`${sans.variable} ${mono.variable} ${display.variable}`}
		>
			<body className='font-sans'>
				{/* Скрипты страницы не загрузились — вместо чёрного экрана кнопка «Обновить» */}
				<script dangerouslySetInnerHTML={{ __html: BOOT_FALLBACK }} />
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
