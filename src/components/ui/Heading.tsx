interface IHeading {
	title: string
}

export function Heading({ title }: IHeading) {
	return (
		<div>
			<h1 className='text-2xl font-medium leading-tight sm:text-3xl'>
				{title}
			</h1>
			<div className='my-3 h-0.5 bg-border w-full' />
		</div>
	)
}
