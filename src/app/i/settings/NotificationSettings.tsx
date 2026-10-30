'use client'

import cn from 'clsx'
import { BellOff, BellRing, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { isNativeApp } from '@/lib/native'
import {
	type TypePushState,
	desktopBridge,
	disablePush,
	enablePush,
	getPushState,
	sendTestPush
} from '@/lib/push'

const STATUS: Record<TypePushState, string> = {
	unsupported:
		'Этот браузер не умеет получать уведомления. На Android установите сайт на главный экран (меню Chrome → «Добавить на главный экран»), на компьютере — откройте в Chrome или Edge.',
	denied:
		'Уведомления запрещены в настройках браузера. Разрешите их для этого сайта (значок замка в адресной строке) и обновите страницу.',
	off: 'На этом устройстве уведомления выключены.',
	on: 'Это устройство получает напоминания — даже когда планер закрыт.'
}

// В настольном приложении уведомления показывает Windows, пока Planner запущен (в том числе в трее)
const DESKTOP_STATUS: Record<TypePushState, string> = {
	unsupported:
		'Эта версия приложения не умеет показывать уведомления — скачайте новую Planner.exe.',
	denied:
		'Уведомления Windows для Planner выключены. Нажмите кнопку — появится окно с разрешением.',
	off: 'Уведомления Windows пока не разрешены.',
	on: 'Напоминания придут уведомлениями Windows, пока Planner запущен — в том числе свёрнутым в трей.'
}

// В Android-приложении напоминания ставятся в систему и приходят, даже когда оно закрыто
const ANDROID_STATUS: Record<TypePushState, string> = {
	unsupported:
		'Обновите приложение Planner — эта версия не умеет показывать уведомления.',
	denied:
		'Уведомления для Planner выключены в Android. Включите их: Настройки → Приложения → Planner → Уведомления.',
	off: 'Уведомления пока не разрешены.',
	on: 'Напоминания придут уведомлениями Android — даже когда приложение закрыто.'
}

/** Включение веб-пуша на текущем устройстве и проверка, что уведомления доходят */
export function NotificationSettings() {
	const [state, setState] = useState<TypePushState | null>(null)
	const [busy, setBusy] = useState(false)
	const [isDesktop, setIsDesktop] = useState(false)
	const [isAndroid, setIsAndroid] = useState(false)
	useEffect(() => {
		setIsDesktop(Boolean(desktopBridge()))
		setIsAndroid(isNativeApp())
	}, [])
	const status = isAndroid
		? ANDROID_STATUS
		: isDesktop
			? DESKTOP_STATUS
			: STATUS

	useEffect(() => {
		getPushState()
			.then(setState)
			.catch(() => setState('unsupported'))
	}, [])

	const run = async (action: () => Promise<unknown>, success?: string) => {
		setBusy(true)
		try {
			await action()
			if (success) toast.success(success)
		} catch (error) {
			const message = (error as Error).message
			if (message === 'reload') {
				toast.info('Разрешение сохранено — обновляем страницу')
				setTimeout(() => window.location.reload(), 800)
			} else if (message === 'denied')
				toast.error(
					isDesktop
						? 'Уведомления не разрешены'
						: 'Браузер запретил уведомления'
				)
			else if (message !== 'default')
				toast.error('Не получилось — попробуйте ещё раз')
		} finally {
			setState(await getPushState().catch(() => 'unsupported' as const))
			setBusy(false)
		}
	}

	return (
		<div>
			<div className='flex items-start gap-3 border border-border bg-bg px-4 py-3'>
				{state === 'on' ? (
					<BellRing
						size={18}
						className='mt-0.5 shrink-0 text-success'
					/>
				) : (
					<BellOff
						size={18}
						className='mt-0.5 shrink-0 text-subtle'
					/>
				)}
				<p
					className={cn(
						'text-sm leading-6',
						state === 'on' ? 'text-fg' : 'text-muted'
					)}
				>
					{state ? status[state] : 'Проверяем…'}
				</p>
			</div>

			<div className='mt-3 flex flex-wrap gap-2'>
				{state === 'on' ? (
					<>
						<button
							type='button'
							disabled={busy}
							onClick={() =>
								run(async () => {
									const delivered = await sendTestPush()
									if (!delivered) throw new Error('none')
								}, 'Отправили — уведомление появится через пару секунд')
							}
							className='flex h-9 items-center gap-2 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50'
						>
							<Send size={14} />
							Проверить
						</button>
						{!isDesktop && !isAndroid && (
							<button
								type='button'
								disabled={busy}
								onClick={() =>
									run(disablePush, 'Уведомления на этом устройстве выключены')
								}
								className='h-9 border border-border px-4 text-sm text-muted transition-colors hover:text-fg disabled:opacity-50'
							>
								Выключить здесь
							</button>
						)}
					</>
				) : (
					state !== 'unsupported' && (
						<button
							type='button'
							disabled={busy || (state === 'denied' && !isDesktop)}
							onClick={() =>
								run(
									enablePush,
									'Готово — напоминания будут приходить на это устройство'
								)
							}
							className='flex h-9 items-center gap-2 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50'
						>
							<BellRing size={14} />
							{isDesktop
								? 'Разрешить уведомления Windows'
								: 'Включить на этом устройстве'}
						</button>
					)
				)}
			</div>
			<p className='mt-3 text-xs leading-5 text-subtle'>
				Включайте на каждом устройстве отдельно: компьютер и телефон. Время и
				напоминания задаются в задаче — в панели «Подзадачи и заметка».
			</p>
		</div>
	)
}
