import type { Location } from '../../types/location';

const compact = (values: Array<string | null | undefined>) => {
	return values
		.map((value) => value?.trim())
		.filter((value): value is string => Boolean(value));
};

export const formatLocationAddress = (
	location: Pick<
		Location,
		'addressLine1' | 'addressLine2' | 'city' | 'state' | 'postalCode'
	>
): string | null => {
	const line1 = compact([location.addressLine1, location.addressLine2]).join(', ');
	const line2 = compact([location.city, location.state, location.postalCode]).join(', ');

	const parts = compact([line1, line2]);

	if (parts.length === 0) {
		return null;
	}

	return parts.join(' • ');
};