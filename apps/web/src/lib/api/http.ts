import axios, { type InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import { sessionStore } from '../auth/session-store';
import { normalizeApiError } from './errors';

const attachHeaders = (config: InternalAxiosRequestConfig) => {
	const accessToken = sessionStore.getAccessToken();

	if (accessToken) {
		config.headers.set('Authorization', `Bearer ${accessToken}`);
	}

	const activeTenantSlug = sessionStore.getActiveTenantSlug();

	if (activeTenantSlug) {
		config.headers.set('X-Tenant-Slug', activeTenantSlug);
	}

	return config;
};

export const http = axios.create({
	baseURL: env.apiBaseUrl,
	withCredentials: true,
});

http.interceptors.request.use(attachHeaders);

http.interceptors.response.use(
	(response) => response,
	(error) => Promise.reject(normalizeApiError(error))
);