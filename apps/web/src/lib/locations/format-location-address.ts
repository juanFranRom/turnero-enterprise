import type { Location } from '../../types/location';

export const formatLocationAddress = (location: Pick<
	Location,
	'addressLine1' | 'addressLine2' | 'city' | 'state' | 'postalCode'
>): string | null => {
	const parts = [
		location.addressLine1,
		location.addressLine2,
		location.city,
		location.state,
		location.postalCode,
	]
		.map((value) => value?.trim())
		.filter((value): value is string => Boolean(value));

	if (!parts.length) {
		return null;
	}

	return parts.join(', ');
};