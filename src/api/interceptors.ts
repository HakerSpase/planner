import axios, { type CreateAxiosDefaults } from 'axios'

const options: CreateAxiosDefaults = {
	baseURL: '/api',
	headers: {
		'Content-Type': 'application/json'
	},
	withCredentials: true
}

const axiosClassic = axios.create(options)
const axiosWithAuth = axios.create(options)

axiosWithAuth.interceptors.response.use(
	config => config,
	async error => {
		if (error?.response?.status === 401 && typeof window !== 'undefined') {
			if (!window.location.pathname.startsWith('/auth')) {
				window.location.href = '/auth'
			}
		}
		throw error
	}
)

export { axiosClassic, axiosWithAuth }
