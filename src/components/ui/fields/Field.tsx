import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputFieldProps extends Omit<
	InputHTMLAttributes<HTMLInputElement>,
	'id' | 'placeholder' | 'disabled' | 'type'
> {
	id: string
	label: string
	extra?: string
	placeholder: string
	variant?: string
	state?: 'error' | 'success'
	disabled?: boolean
	type?: string
	isNumber?: boolean
}

export const Field = forwardRef<HTMLInputElement, InputFieldProps>(
	(
		{
			label,
			id,
			extra,
			type,
			placeholder,
			state,
			disabled,
			isNumber,
			onKeyDown,
			...rest
		},
		ref
	) => {
		return (
			<div className={extra}>
				<label
					htmlFor={id}
					className='text-sm font-medium text-muted'
				>
					{label}
				</label>
				<input
					ref={ref}
					disabled={disabled}
					type={isNumber ? 'number' : type}
					id={id}
					placeholder={placeholder}
					className={`mt-1.5 flex h-10 w-full items-center rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-primary/70 focus:ring-2 focus:ring-primary/20 ${
						disabled === true
							? 'cursor-not-allowed opacity-50'
							: state === 'error'
								? '!border-danger/70 focus:!ring-danger/20'
								: state === 'success'
									? '!border-success/70'
									: ''
					}`}
					onKeyDown={event => {
						onKeyDown?.(event)
						if (event.defaultPrevented) return
						if (
							isNumber &&
							!/[0-9]/.test(event.key) &&
							event.key !== 'Backspace' &&
							event.key !== 'Tab' &&
							event.key !== 'Enter' &&
							event.key !== 'ArrowLeft' &&
							event.key !== 'ArrowRight'
						) {
							event.preventDefault()
						}
					}}
					{...rest}
				/>
			</div>
		)
	}
)

Field.displayName = 'field'
