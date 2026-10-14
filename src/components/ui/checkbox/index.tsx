import cn from 'clsx'
import { Check } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'

interface CheckboxProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
	extra?: string
	color?: string
}

const Checkbox = ({
	id,
	checked,
	onChange,
	disabled,
	extra,
	className,
	...rest
}: CheckboxProps) => {
	return (
		<label
			htmlFor={id}
			className={cn(
				'relative inline-flex h-5 w-5 shrink-0 cursor-pointer select-none items-center justify-center transition-colors',
				'border',
				checked
					? 'border-primary bg-primary text-white shadow-sm'
					: 'border-white/25 bg-transparent hover:border-white/45',
				disabled && 'cursor-not-allowed opacity-50',
				extra,
				className
			)}
		>
			<input
				id={id}
				type='checkbox'
				checked={Boolean(checked)}
				onChange={onChange}
				disabled={disabled}
				className='sr-only'
				{...rest}
			/>
			{checked && (
				<Check
					size={13}
					strokeWidth={3}
					className='pointer-events-none text-white'
				/>
			)}
		</label>
	)
}

export default Checkbox
