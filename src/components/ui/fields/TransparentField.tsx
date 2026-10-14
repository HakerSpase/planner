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
				'w-full min-w-0 bg-transparent px-1 py-0.5 text-sm sm:text-base text-white/90 placeholder:text-white/35',
				'border-none outline-none focus:outline-none focus:ring-0',
				'focus:text-white transition-colors duration-150',
				className
			)}
			{...rest}
		/>
	)
})

TransparentField.displayName = 'TransparentField'
