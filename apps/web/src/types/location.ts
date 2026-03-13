export type Location = {
	id: string;
	tenantId: string;
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

export type CreateLocationInput = {
	name: string;
	timeZone: string;
	isActive?: boolean;
	phone?: string;
	addressLine1?: string;
	addressLine2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
};

export type UpdateLocationInput = Partial<CreateLocationInput>;

export type ListLocationsParams = {
	cursor?: string;
	limit?: number;
	search?: string;
	isActive?: boolean;
	direction?: 'asc' | 'desc';
};

export type CursorListMeta = {
	nextCursor: string | null;
	hasMore: boolean;
};

export type ListLocationsResponse = {
	items: Location[];
	meta: CursorListMeta;
};