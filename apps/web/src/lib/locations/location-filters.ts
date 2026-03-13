export type LocationStatusFilter = 'all' | 'active' | 'inactive';
export type LocationSortDirection = 'desc' | 'asc';

export const parseLocationStatusFilter = (
	value: string | null
): LocationStatusFilter => {
	if (value === 'active' || value === 'inactive') {
		return value;
	}

	return 'all';
};

export const parseLocationSortDirection = (
	value: string | null
): LocationSortDirection => {
	if (value === 'asc') {
		return 'asc';
	}

	return 'desc';
};

export const mapStatusFilterToApi = (
	status: LocationStatusFilter
): boolean | undefined => {
	if (status === 'active') {
		return true;
	}

	if (status === 'inactive') {
		return false;
	}

	return undefined;
};