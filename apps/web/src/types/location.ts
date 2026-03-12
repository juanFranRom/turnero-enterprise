export type Location = {
	id: string;
	name: string;
	timeZone: string;
	isActive: boolean;
	phone: string | null;
	addressLine1: string | null;
	addressLine2: string | null;
	city: string | null;
	state: string | null;
	postalCode: string | null;
	createdAt: string;
	updatedAt: string;
};

export type LocationsListResponse = {
	items: Location[];
	nextCursor: string | null;
};

export type CreateLocationInput = {
	name: string;
	timeZone?: string;
	isActive?: boolean;
	phone?: string;
	addressLine1?: string;
	addressLine2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
};

export type UpdateLocationInput = {
	name?: string;
	timeZone?: string;
	isActive?: boolean;
	phone?: string;
	addressLine1?: string;
	addressLine2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
};