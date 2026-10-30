'use client'

import cn from 'clsx'
import { type ReactNode, useEffect, useState } from 'react'

import {
	type TypeHapticLevel,
	type TypeMusicStyle,
	type TypeTransition,
	haptic,
	usePreferences
} from '@/lib/preferences'

/* Мост к настольному приложению (Electron/Tauri кладёт его в window) */
interface IDesktopBridge {
	getSettings: () => Promise<{ tray: boolean; autostart: boolean }>
	setSettings: (patch: Partial<{ tray: boolean; autostart: boolean }>) => Promise<void>
}

declare global {
	interface Window {
		plannerDesktop?: IDesktopBridge
	}
}

const MUSIC_STYLES: [TypeMusicStyle, string, string][] = [
	['lofi', 'Лоу-фай', 'Бит, электропиано'],
	['jazz', 'Ночной джаз', 'Щётки, шагающий бас'],
	['piano', 'Фортепиано', 'Тихий перебор'],
	['ambient', 'Эмбиент', 'Медленные пэды'],
	['rain', 'Дождь', 'Капли и редкие ноты'],
	['forest', 'Лес', 'Ручей и птицы'],
	['space', 'Космос', 'Мерцание с эхом'],
	['fire', 'Камин', 'Треск и переборы']
]

function Segmented<T extends string>({
	value,
	options,
	onChange
}: {
	value: T
	options: [T, string][]
	onChange: (value: T) => void
}) {
	return (
		<div className='inline-flex divide-x divide-border border border-border'>
			{options.map(([option, label]) => (
				<button
					key={option}
					type='button'
					onClick={() => onChange(option)}
					aria-pressed={value === option}
					className={cn(
						'h-9 px-3.5 text-sm transition-colors',
						value === option ? 'bg-white/[0.08] text-fg' : 'text-muted hover:text-fg'
					)}
				>
					{label}
				</button>
			))}
		</div>
	)
}

function Toggle({
	checked,
	onChange,
	label,
	hint
}: {
	checked: boolean
	onChange: (value: boolean) => void
	label: string
	hint?: string
}) {
	return (
		<button
			type='button'
			role='switch'
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className='flex w-full items-center justify-between gap-4 py-2.5 text-left'
		>
			<span className='min-w-0'>
				<span className='block text-sm text-fg'>{label}</span>
				{hint && <span className='block text-xs text-subtle'>{hint}</span>}
			</span>
			<span
				className={cn(
					'relative h-5 w-9 shrink-0 transition-colors',
					checked ? 'bg-primary' : 'bg-white/15'
				)}
			>
				<span
					className={cn(
						'absolute top-0.5 h-4 w-4 bg-white transition-transform',
						checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
					)}
				/>
			</span>
		</button>
	)
}

function Row({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className='border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0'>
			<p className='eyebrow mb-3'>{title}</p>
			{children}
		</div>
	)
}

/** Переходы, музыка, вибрация — настройки устройства, применяются сразу */
export function FeelSettings() {
	const [preferences, setPreferences] = usePreferences()

	return (
		<div>
			<Row title='Переходы между разделами'>
				<Segmented<TypeTransition>
					value={preferences.transition}
					onChange={transition => setPreferences({ transition })}
					options={[
						['off', 'Выкл'],
						['soft', 'Мягко'],
						['smooth', 'Плавно']
					]}
				/>
			</Row>

			<Row title='Фоновая музыка'>
				<Toggle
					checked={preferences.music}
					onChange={music => setPreferences({ music })}
					label='Играть во время работы'
					hint='Генерируется на лету, не повторяется. На время дыхания затихает.'
				/>
				<div className={cn('mt-3 space-y-4', !preferences.music && 'pointer-events-none opacity-40')}>
					<div
						role='radiogroup'
						aria-label='Стиль музыки'
						className='grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4'
					>
						{MUSIC_STYLES.map(([style, label, hint]) => (
							<button
								key={style}
								type='button'
								role='radio'
								aria-checked={preferences.musicStyle === style}
								onClick={() => setPreferences({ musicStyle: style })}
								className={cn(
									'px-3 py-2.5 text-left transition-colors',
									preferences.musicStyle === style
										? 'bg-elevated text-fg shadow-[inset_0_-2px_0_rgb(var(--primary))]'
										: 'bg-surface text-muted hover:text-fg'
								)}
							>
								<span className='block text-sm'>{label}</span>
								<span className='block text-xs leading-4 text-subtle'>{hint}</span>
							</button>
						))}
					</div>
					<label className='flex items-center gap-3'>
						<span className='w-20 text-xs text-muted'>Громкость</span>
						<input
							type='range'
							min={0}
							max={100}
							value={preferences.musicVolume}
							onChange={event => setPreferences({ musicVolume: Number(event.target.value) })}
							className='h-1 flex-1 cursor-pointer appearance-none bg-white/15 accent-primary'
						/>
						<span className='w-9 text-right font-mono text-xs tabular-nums text-subtle'>
							{preferences.musicVolume}%
						</span>
					</label>
				</div>
			</Row>

			<Row title='Вибрация (телефон)'>
				<Segmented<TypeHapticLevel>
					value={preferences.haptics}
					onChange={haptics => {
						setPreferences({ haptics })
						setTimeout(() => haptic('nav'), 0)
					}}
					options={[
						['off', 'Выкл'],
						['light', 'Лёгкая'],
						['strong', 'Сильнее']
					]}
				/>
				<div className={cn('mt-2', preferences.haptics === 'off' && 'pointer-events-none opacity-40')}>
					<Toggle
						checked={preferences.hapticNav}
						onChange={hapticNav => setPreferences({ hapticNav })}
						label='Переходы по разделам'
					/>
					<Toggle
						checked={preferences.hapticChecks}
						onChange={hapticChecks => setPreferences({ hapticChecks })}
						label='Отметка задач и чек-листов'
					/>
					<Toggle
						checked={preferences.hapticButtons}
						onChange={hapticButtons => setPreferences({ hapticButtons })}
						label='Нажатия на кнопки'
					/>
				</div>
				<p className='mt-2 text-xs text-subtle'>На iPhone браузеры вибрацию не поддерживают.</p>
			</Row>
		</div>
	)
}

/** Трей и автозапуск — показываются только в настольном приложении */
export function DesktopSettings() {
	const [bridge, setBridge] = useState<IDesktopBridge | null>(null)
	const [settings, setSettings] = useState<{ tray: boolean; autostart: boolean } | null>(null)

	useEffect(() => {
		if (!window.plannerDesktop) return
		setBridge(window.plannerDesktop)
		window.plannerDesktop.getSettings().then(setSettings).catch(() => {})
	}, [])

	if (!bridge || !settings) return null

	const update = async (patch: Partial<{ tray: boolean; autostart: boolean }>) => {
		setSettings({ ...settings, ...patch })
		await bridge.setSettings(patch)
	}

	return (
		<div>
			<Toggle
				checked={settings.tray}
				onChange={tray => update({ tray })}
				label='Сворачивать в трей'
				hint='Крестик прячет окно в трей, Planner продолжает работать'
			/>
			<Toggle
				checked={settings.autostart}
				onChange={autostart => update({ autostart })}
				label='Запускать вместе с компьютером'
			/>
		</div>
	)
}

export const isDesktopApp = () => typeof window !== 'undefined' && Boolean(window.plannerDesktop)
