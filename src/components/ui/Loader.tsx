import { Loader2 } from 'lucide-react'

const Loader = () => {
	return (
		<div className='flex items-center justify-center'>
			<Loader2 className='h-4 w-4 animate-spin text-muted' />
		</div>
	)
}

export default Loader
