import axios, {
	AxiosError,
	InternalAxiosRequestConfig,
} from 'axios';
import { sessionStore } from '../auth/session-store';

type RetryableRequestConfig = InternalAxiosRequestConfig & {
	_retry?: boolean;
};

const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '/api';

const clearClientSession = () => {
	sessionStore.clear();

	if (typeof window !== 'undefined') {
		window.localStorage.removeItem('timora.activeRole');
	}
};

export const http = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true,
});

http.interceptors.request.use((config) => {
	const token = sessionStore.getAccessToken();
	const tenantSlug = sessionStore.getActiveTenantSlug();

	config.headers = config.headers ?? {};

	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}

	if (tenantSlug) {
		config.headers['X-Tenant-Slug'] = tenantSlug;
	}

	return config;
});

let refreshPromise: Promise<string | null> | null = null;

const shouldSkipRefresh = (url?: string) => {
	if (!url) {
		return false;
	}

	return (
		url.includes('/auth/login') ||
		url.includes('/auth/refresh') ||
		url.includes('/auth/logout')
	);
};

const runRefresh = async (): Promise<string | null> => {
	if (!refreshPromise) {
		refreshPromise = (async () => {
			try {
				console.log('[http] attempting refresh');

				const response = await axios.post<{ accessToken: string }>(
					`${API_BASE_URL}/auth/refresh`,
					undefined,
					{
						withCredentials: true,
						headers: {
							...(sessionStore.getActiveTenantSlug()
								? {
										'X-Tenant-Slug':
											sessionStore.getActiveTenantSlug(),
									}
								: {}),
						},
					}
				);

				const nextAccessToken = response.data.accessToken;
				sessionStore.setAccessToken(nextAccessToken);

				return nextAccessToken;
			} catch (error) {
				console.error('[http] refresh failed', error);
				clearClientSession();
				return null;
			} finally {
				refreshPromise = null;
			}
		})();
	}

	return refreshPromise;
};

http.interceptors.response.use(
	(response) => response,
	async (error: AxiosError) => {
		const originalRequest = error.config as RetryableRequestConfig | undefined;
		const status = error.response?.status;

		if (!originalRequest || status !== 401) {
			return Promise.reject(error);
		}

		if (originalRequest._retry || shouldSkipRefresh(originalRequest.url)) {
			return Promise.reject(error);
		}

		originalRequest._retry = true;

		const nextAccessToken = await runRefresh();

		if (!nextAccessToken) {
			if (typeof window !== 'undefined') {
				const next = window.location.pathname + window.location.search;
				window.location.href = `/login?next=${encodeURIComponent(next)}`;
			}

			return Promise.reject(error);
		}

		originalRequest.headers = originalRequest.headers ?? {};
		originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;

		return http(originalRequest);
	}
);