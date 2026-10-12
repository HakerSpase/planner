import { ITimeBlockResponse } from '@/types/time-block.types'

export function calcHoursLeft(items: ITimeBlockResponse[] | undefined) {
	const totalMinutes = items?.reduce((acc, item) => acc + item.duration, 0) || 0
	const dayMinutes = 24 * 60
	const remainingMinutes = Math.max(0, dayMinutes - totalMinutes)

	return {
		totalMinutes,
		remainingMinutes,
		overbookedMinutes: Math.max(0, totalMinutes - dayMinutes)
	}
}
