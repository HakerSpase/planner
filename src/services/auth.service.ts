import { axiosClassic } from '@/api/interceptors'

export const authService = {
	async logout() {
		const response = await axiosClassic.post('/auth/logout')
		return response
	}
}
