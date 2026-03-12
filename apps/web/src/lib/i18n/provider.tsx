'use client';

import {
	createContext,
	useContext,
	useMemo,
	useState,
	type PropsWithChildren,
} from 'react';

import { dictionaries } from './dictionary';
import { localeStore } from './locale-store';

import type { AppLocale } from '../../types/i18n';

type I18nContextValue = {

	locale: AppLocale;

	setLocale: (locale: AppLocale) => void;

	t: (key: string) => string;

};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {

	const [locale, setLocaleState] = useState<AppLocale>(() => localeStore.get());

	const value = useMemo(() => {

		const dictionary = dictionaries[locale];

		return {

			locale,

			setLocale: (next: AppLocale) => {

				localeStore.set(next);

				setLocaleState(next);

			},

			t: (key: string) => dictionary[key] ?? key,

		};

	}, [locale]);

	return (
		<I18nContext.Provider value={value}>
			{children}
		</I18nContext.Provider>
	);
}

export function useI18n() {

	const ctx = useContext(I18nContext);

	if (!ctx) {
		throw new Error('useI18n must be used within I18nProvider');
	}

	return ctx;
}