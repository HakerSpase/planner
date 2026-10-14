import cn from 'clsx'
import { type InputHTMLAttributes, forwardRef } from 'react'

type TypeTransparentField = InputHTMLAttributes<HTMLInputElement>

export const TransparentField = forwardRef<
	HTMLInputElement,
	TypeTransparentField
>(({ className, placeholder = 'Название задачи...', ...rest }, ref) => {
	return (
		<input
			ref={ref}
			placeholder={placeholder}
			className={cn(
				'w-full min-w-0 bg-transparent px-2 py-1 text-sm sm:text-base text-white/90 placeholder:text-white/35',
				'border border-transparent hover:border-white/10 focus:border-white/20',
				'hover:bg-white/[0.03] focus:bg-white/[0.06]',
				'focus:text-white focus:outline-none transition-colors duration-150',
				className
			)}
			{...rest}
		/>
	)
})

TransparentField.displayName = 'TransparentField'
