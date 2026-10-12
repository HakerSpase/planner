import { useProfile } from '@/hooks/useProfile'

export function useLoadSettings() {
	const { data } = useProfile()

	const workInterval = data?.user.workInterval ?? 50
	const breakInterval = data?.user.breakInterval ?? 10
	const timeZone =
		data?.user.timeZone ||
		Intl.DateTimeFormat().resolvedOptions().timeZone ||
		'UTC'

	return { workInterval, breakInterval, timeZone }
}
