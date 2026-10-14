import { axiosWithAuth } from '@/api/interceptors'

export interface IBreathingSession {
	id: string
	technique_id: string
	technique_name: string
	duration_seconds: number
	cycles_count: number
	created_at: string
}

export interface ICreateBreathingSessionDto {
	techniqueId: string
	techniqueName: string
	durationSeconds: number
	cyclesCount: number
}

class BreathingService {
	private BASE_URL = '/user/breathing'

	async getSessions() {
		const response = await axiosWithAuth.get<IBreathingSession[]>(this.BASE_URL)
		return response
	}

	async saveSession(data: ICreateBreathingSessionDto) {
		const response = await axiosWithAuth.post<IBreathingSession>(
			this.BASE_URL,
			data
		)
		return response
	}
}

export const breathingService = new BreathingService()
