import { useI18n } from './provider';

export function useT() {

	const { t } = useI18n();

	return t;
}