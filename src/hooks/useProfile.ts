import { useQuery } from '@tanstack/react-query'

import { userService } from '@/services/user.service'

export function useProfile() {
	const { data, isLoading, isSuccess } = useQuery({
		queryKey: ['profile'],
		queryFn: () => userService.getProfile(),
		// профиль меняется только в настройках (там кэш сбрасывается) — не перезапрашиваем зря
		staleTime: 10 * 60_000
	})

	return { data, isLoading, isSuccess }
}
