import debounce from 'lodash.debounce'
import { useCallback, useEffect, useRef, useState } from 'react'
import { UseFormWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { ITaskResponse, TypeTaskFormState } from '@/types/task.types'

import { useCreateTask } from './useCreateTask'
import { useUpdateTask } from './useUpdateTask'

interface IUseTaskDebounce {
	watch: UseFormWatch<TypeTaskFormState>
	itemId: string
	setItems: React.Dispatch<React.SetStateAction<ITaskResponse[] | undefined>>
}

export function useTaskDebounce({ watch, itemId, setItems }: IUseTaskDebounce) {
	const { createTask } = useCreateTask()
	const { updateTask } = useUpdateTask()
	const isDraft = itemId.startsWith('draft-')
	const createStarted = useRef(false)
	const latestDraftData = useRef<TypeTaskFormState>({})
	const draftRevision = useRef(0)
	const [isCreating, setIsCreating] = useState(false)

	const saveDraft = useCallback(
		(formData: TypeTaskFormState) => {
			if (createStarted.current || !formData.name?.trim()) return
			createStarted.current = true
			setIsCreating(true)
			const requestRevision = draftRevision.current
			createTask(formData, {
				onSuccess(response) {
					const createdTask = response.data as ITaskResponse
					setItems(current =>
						current?.map(task => (task.id === itemId ? createdTask : task))
					)
					if (draftRevision.current > requestRevision) {
						updateTask({ id: createdTask.id, data: latestDraftData.current })
					}
					setIsCreating(false)
				},
				onError() {
					createStarted.current = false
					setIsCreating(false)
					toast.error(
						'Не удалось сохранить задачу. Изменения остались в карточке.'
					)
				}
			})
		},
		[createTask, itemId, setItems, updateTask]
	)

	const debouncedCreateTask = useCallback(
		debounce((formData: TypeTaskFormState) => saveDraft(formData), 444),
		[saveDraft]
	)

	// Теперь debouncedUpdateTask будет сохраняться между рендерами, и debounce будет работать как ожидается.
	const debouncedUpdateTask = useCallback(
		debounce((formData: TypeTaskFormState) => {
			updateTask({ id: itemId, data: formData })
		}, 444),
		[itemId, updateTask]
	)

	useEffect(() => {
		const { unsubscribe } = watch(formData => {
			if (isDraft) {
				latestDraftData.current = formData
				draftRevision.current += 1
				if (!createStarted.current) debouncedCreateTask(formData)
			} else if (itemId) {
				debouncedUpdateTask({
					...formData,
					priority: formData.priority || undefined
				})
			} else {
				debouncedCreateTask(formData)
			}
		})

		return () => {
			unsubscribe()
			if (isDraft) {
				debouncedCreateTask.cancel()
				debouncedUpdateTask.cancel()
			} else {
				debouncedUpdateTask.flush()
			}
		}
	}, [watch, itemId, isDraft, debouncedUpdateTask, debouncedCreateTask])

	return { isCreating }
}
