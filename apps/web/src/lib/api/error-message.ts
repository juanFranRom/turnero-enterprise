import type { ApiClientError } from './errors';

type TranslateFn = (key: string) => string;

export const getApiErrorMessage = (
	error: unknown,
	t: TranslateFn
): string => {
	if (
		error &&
		typeof error === 'object' &&
		'code' in error &&
		typeof (error as { code?: unknown }).code === 'string'
	) {
		const code = (error as ApiClientError).code;
		const translated = t(`errors.${code}`);

		if (translated !== `errors.${code}`) {
			return translated;
		}

		if (
			'message' in error &&
			typeof (error as { message?: unknown }).message === 'string' &&
			(error as { message: string }).message.trim()
		) {
			return (error as { message: string }).message;
		}
	}

	return t('errors.generic');
};