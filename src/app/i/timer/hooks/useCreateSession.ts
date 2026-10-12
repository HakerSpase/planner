import { useMutation, useQueryClient } from '@tanstack/react-query'

import { pomodoroService } from '@/services/pomodoro.service'

export function useCreateSession(timeZone: string) {
	const queryClient = useQueryClient()

	const { mutate, isPending } = useMutation({
		mutationKey: ['create new session'],
		mutationFn: () => pomodoroService.createSession(),
		onSuccess(response) {
			queryClient.setQueryData(['get today session', timeZone], response)
		}
	})

	return { mutate, isPending }
}
