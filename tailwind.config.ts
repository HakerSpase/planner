import type { Config } from 'tailwindcss'

// Цвета берутся из CSS-переменных в globals.scss — так вся тема меняется в одном месте
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
	darkMode: 'class',
	content: [
		'./src/pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./src/components/**/*.{js,ts,jsx,tsx,mdx}',
		'./src/app/**/*.{js,ts,jsx,tsx,mdx}'
	],
	theme: {
		screens: {
			sm: '576px',
			'sm-max': { max: '576px' },
			md: '768px',
			'md-max': { max: '768px' },
			lg: '992px',
			'lg-max': { max: '992px' },
			xl: '1200px',
			'xl-max': { max: '1200px' },
			'2xl': '1320px',
			'2xl-max': { max: '1320px' },
			'3xl': '1600px',
			'3xl-max': { max: '1600px' }
		},
		// Строгий стиль: все скругления — ноль. Круг остаётся только у rounded-full (дыхание и т.п.)
		borderRadius: {
			none: '0',
			sm: '0',
			DEFAULT: '0',
			md: '0',
			lg: '0',
			xl: '0',
			'2xl': '0',
			'3xl': '0',
			full: '9999px'
		},
		extend: {
			colors: {
				bg: token('bg'),
				surface: token('surface'),
				'surface-2': token('surface-2'),
				elevated: token('elevated'),
				sidebar: token('surface'),
				border: 'rgb(255 255 255 / 0.08)',
				'border-strong': 'rgb(255 255 255 / 0.14)',
				fg: token('fg'),
				muted: token('muted'),
				subtle: token('subtle'),
				primary: {
					DEFAULT: token('primary'),
					hover: token('primary-hover'),
					soft: 'rgb(var(--primary) / 0.14)'
				},
				secondary: '#F97912',
				danger: token('danger'),
				success: token('success'),
				warning: token('warning')
			},
			fontFamily: {
				sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
				mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
				display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif']
			},
			fontSize: {
				'2xs': ['0.6875rem', { lineHeight: '1rem' }],
				xs: ['0.75rem', { lineHeight: '1.1rem' }],
				sm: ['0.875rem', { lineHeight: '1.35rem' }],
				base: ['0.9375rem', { lineHeight: '1.5rem' }],
				lg: ['1.0625rem', { lineHeight: '1.6rem' }],
				xl: ['1.25rem', { lineHeight: '1.75rem' }],
				'1.5xl': ['1.375rem', { lineHeight: '1.85rem' }],
				'2xl': ['1.5rem', { lineHeight: '2rem' }],
				'3xl': ['1.875rem', { lineHeight: '2.25rem' }],
				'4xl': ['2.25rem', { lineHeight: '2.6rem' }],
				'5xl': ['3rem', { lineHeight: '1.1' }],
				'6xl': ['3.75rem', { lineHeight: '1' }],
				'7xl': ['4.5rem', { lineHeight: '1' }],
				'8xl': ['6rem', { lineHeight: '1' }],
				'9xl': ['8rem', { lineHeight: '1' }]
			},
			spacing: {
				layout: '1.5rem',
				'big-layout': '2.5rem'
			},
			boxShadow: {
				card: 'none',
				pop: '0 16px 40px -12px rgb(0 0 0 / 0.8)'
			},
			transitionDuration: {
				DEFAULT: '160ms'
			},
			keyframes: {
				'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
				'pop-in': {
					from: { opacity: '0', transform: 'translateY(4px)' },
					to: { opacity: '1', transform: 'none' }
				}
			},
			animation: {
				'fade-in': 'fade-in 160ms ease-out',
				'pop-in': 'pop-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1)'
			}
		}
	},
	plugins: []
}
export default config
