import type { CSSProperties, PropsWithChildren } from 'react'
import { tv } from 'tailwind-variants'

interface IBadge {
	className?: string
	variant?: string
	style?: CSSProperties
}

const badge = tv({
	base: 'inline-flex w-max max-w-full items-center gap-2 py-0.5 text-xs font-medium text-muted transition-colors hover:text-fg before:h-1.5 before:w-1.5 before:shrink-0',
	variants: {
		backgroundColor: {
			gray: 'text-subtle before:hidden',
			high: 'before:bg-danger',
			medium: 'before:bg-warning',
			low: 'before:bg-sky-400'
		}
	},
	defaultVariants: {
		backgroundColor: 'gray'
	}
})

export function Badge({
	children,
	className,
	variant,
	style
}: PropsWithChildren<IBadge>) {
	return (
		<span
			className={badge({
				backgroundColor: variant as 'low' | 'high' | 'medium',
				className
			})}
			style={style}
		>
			{children}
		</span>
	)
}
