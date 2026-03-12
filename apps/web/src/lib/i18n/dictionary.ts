import type { AppLocale, TranslationDictionary } from '../../types/i18n';
import { esAR } from '../../messages/es-AR';
import { en } from '../../messages/en';

export const dictionaries: Record<AppLocale, TranslationDictionary> = {
	'es-AR': esAR,
	en,
};