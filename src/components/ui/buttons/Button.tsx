import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { type VariantProps, tv } from 'tailwind-variants'

export const button = tv({
	base: 'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-45',
	variants: {
		variant: {
			primary: 'bg-primary text-white hover:bg-primary-hover',
			secondary:
				'border border-border bg-surface-2 text-fg hover:border-border-strong hover:bg-elevated',
			ghost: 'text-muted hover:bg-white/[0.06] hover:text-fg',
			danger: 'bg-danger/10 text-danger hover:bg-danger/20'
		},
		size: {
			sm: 'h-8 px-3 text-sm',
			md: 'h-10 px-4 text-sm',
			lg: 'h-11 px-5 text-base',
			icon: 'h-9 w-9 p-0'
		}
	},
	defaultVariants: {
		variant: 'primary',
		size: 'md'
	}
})

type TypeButton = ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof button>

export function Button({
	children,
	className,
	variant,
	size,
	...rest
}: PropsWithChildren<TypeButton>) {
	return (
		<button
			className={button({ variant, size, className })}
			{...rest}
		>
			{children}
		</button>
	)
}
