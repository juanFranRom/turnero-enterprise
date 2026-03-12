import type { AppLocale } from '../../types/i18n';

export const formatDate = (value: Date | string, locale: AppLocale) => {

	const date = value instanceof Date ? value : new Date(value);

	return new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(date);

};

export const formatTime = (value: Date | string, locale: AppLocale) => {

	const date = value instanceof Date ? value : new Date(value);

	return new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);

};