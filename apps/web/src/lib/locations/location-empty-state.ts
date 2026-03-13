import type { LocationStatusFilter } from './location-filters';

type TranslateFn = (key: string) => string;

type LocationEmptyStateInput = {
	search: string;
	status: LocationStatusFilter;
	t: TranslateFn;
};

export const getLocationEmptyState = ({
	search,
	status,
	t,
}: LocationEmptyStateInput) => {
	const hasSearch = search.trim().length > 0;

	if (hasSearch && status === 'active') {
		return {
			title: t('locations.empty.filteredActive.title'),
			description: t('locations.empty.filteredActive.description'),
		};
	}

	if (hasSearch && status === 'inactive') {
		return {
			title: t('locations.empty.filteredInactive.title'),
			description: t('locations.empty.filteredInactive.description'),
		};
	}

	if (hasSearch) {
		return {
			title: t('locations.empty.search.title'),
			description: t('locations.empty.search.description'),
		};
	}

	if (status === 'active') {
		return {
			title: t('locations.empty.active.title'),
			description: t('locations.empty.active.description'),
		};
	}

	if (status === 'inactive') {
		return {
			title: t('locations.empty.inactive.title'),
			description: t('locations.empty.inactive.description'),
		};
	}

	return {
		title: t('locations.empty.title'),
		description: t('locations.empty.subtitle'),
	};
};