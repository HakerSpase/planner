import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ITaskResponse, TypeTaskFormState } from '@/types/task.types'

import { taskService } from '@/services/task.service'

export function useUpdateTask(key?: string) {
	const queryClient = useQueryClient()

	const { mutate: updateTask } = useMutation({
		mutationKey: ['update task', key],
		mutationFn: ({ id, data }: { id: string; data: TypeTaskFormState }) =>
			taskService.updateTask(id, data),
		async onMutate({ id, data }) {
			await queryClient.cancelQueries({ queryKey: ['tasks'] })
			const previous = queryClient.getQueryData<{
				data: ITaskResponse[]
			}>(['tasks'])

			if (previous) {
				queryClient.setQueryData(['tasks'], {
					...previous,
					data: previous.data.map(task =>
						task.id === id ? { ...task, ...data } : task
					)
				})
			}

			return { previous }
		},
		onError(_error, _variables, context) {
			if (context?.previous) queryClient.setQueryData(['tasks'], context.previous)
		},
		onSuccess(response, { id }) {
			queryClient.setQueryData<{ data: ITaskResponse[] }>(['tasks'], current => {
				if (!current) return current
				return {
					...current,
					data: current.data.map(task =>
						task.id === id ? { ...task, ...response.data } : task
					)
				}
			})
		}
	})

	return { updateTask }
}
