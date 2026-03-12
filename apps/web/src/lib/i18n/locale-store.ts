import type { AppLocale } from '../../types/i18n';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';

const LOCALE_KEY = 'timora.locale';

const isBrowser = () => typeof window !== 'undefined';

export const localeStore = {

	get(): AppLocale {

		if (!isBrowser()) {
			return DEFAULT_LOCALE;
		}

		const stored = window.localStorage.getItem(LOCALE_KEY);

		if (stored && SUPPORTED_LOCALES.includes(stored as AppLocale)) {
			return stored as AppLocale;
		}

		const browser = window.navigator.language.toLowerCase();

		if (browser.startsWith('es')) {
			return 'es-AR';
		}

		if (browser.startsWith('en')) {
			return 'en';
		}

		return DEFAULT_LOCALE;
	},

	set(locale: AppLocale) {

		if (!isBrowser()) {
			return;
		}

		window.localStorage.setItem(LOCALE_KEY, locale);
	},

};