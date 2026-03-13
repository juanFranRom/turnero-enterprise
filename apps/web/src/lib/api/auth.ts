import { http } from './http';
import { sessionStore } from '../auth/session-store';
import type {
	AuthContext,
	LoginInput,
	LoginResponse,
	RefreshResponse,
} from '../../types/auth';

export const authApi = {
	async login(input: LoginInput): Promise<LoginResponse> {
		const { data } = await http.post<LoginResponse>('/auth/login', input);
		sessionStore.setAccessToken(data.accessToken);

		if (data.activeTenantSlug) {
			sessionStore.setActiveTenantSlug(data.activeTenantSlug);
		}

		return data;
	},

	async refresh(): Promise<RefreshResponse> {
		const { data } = await http.post<RefreshResponse>('/auth/refresh');
		sessionStore.setAccessToken(data.accessToken);

		if (data.activeTenantSlug) {
			sessionStore.setActiveTenantSlug(data.activeTenantSlug);
		}

		return data;
	},

	async logout(): Promise<void> {
		try {
			await http.post('/auth/logout');
		} finally {
			sessionStore.clear();
		}
	},

	async me(): Promise<AuthContext> {
		const { data } = await http.get<AuthContext>('/auth/me');
		return data;
	},
};