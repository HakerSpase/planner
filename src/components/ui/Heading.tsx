import type { ReactNode } from 'react'

interface IHeading {
	title: string
	description?: string
	actions?: ReactNode
}

export function Heading({ title, description, actions }: IHeading) {
	return (
		<div className='mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5 sm:mb-8 sm:pb-6'>
			<div className='min-w-0'>
				<h1 className='text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-4xl'>
					{title}
				</h1>
				{description && (
					<p className='mt-1.5 text-sm text-muted'>{description}</p>
				)}
			</div>
			{actions && <div className='flex items-center gap-2'>{actions}</div>}
		</div>
	)
}
