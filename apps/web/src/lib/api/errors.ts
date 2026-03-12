import axios from 'axios';
import type { ApiErrorPayload } from '../../types/api';

export class ApiClientError extends Error {
	public readonly code: string;
	public readonly details?: unknown;
	public readonly status?: number;

	constructor(payload: {
		code: string;
		message: string;
		details?: unknown;
		status?: number;
	}) {
		super(payload.message);
		this.name = 'ApiClientError';
		this.code = payload.code;
		this.details = payload.details;
		this.status = payload.status;
	}
}

const isApiErrorPayload = (value: unknown): value is ApiErrorPayload => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Record<string, unknown>;

	return (
		typeof candidate.code === 'string' &&
		typeof candidate.message === 'string'
	);
};

export const normalizeApiError = (error: unknown): ApiClientError => {
	if (error instanceof ApiClientError) {
		return error;
	}

	if (axios.isAxiosError(error)) {
		const status = error.response?.status;
		const data = error.response?.data;

		if (isApiErrorPayload(data)) {
			return new ApiClientError({
				code: data.code,
				message: data.message,
				details: data.details,
				status,
			});
		}

		if (typeof data === 'string' && data.trim()) {
			return new ApiClientError({
				code: 'HTTP_ERROR',
				message: data,
				status,
			});
		}

		return new ApiClientError({
			code: 'HTTP_ERROR',
			message: error.message || 'Unexpected HTTP error',
			status,
		});
	}

	if (error instanceof Error) {
		return new ApiClientError({
			code: 'UNEXPECTED_ERROR',
			message: error.message,
		});
	}

	return new ApiClientError({
		code: 'UNEXPECTED_ERROR',
		message: 'Unexpected error',
	});
};