type TranslateFn = (key: string) => string;

export const getLocationStatusLabel = (
	isActive: boolean,
	t: TranslateFn
): string => {
	return isActive
		? t('locations.status.active')
		: t('locations.status.inactive');
};