import { http } from './http';
import type {
	CreateLocationInput,
	Location,
	LocationsListResponse,
	UpdateLocationInput,
} from '../../types/location';

type ListLocationsParams = {
	cursor?: string | null;
	limit?: number;
	search?: string;
	isActive?: boolean;
};

export const locationsApi = {
	async list(params: ListLocationsParams = {}): Promise<LocationsListResponse> {
		const { data } = await http.get<LocationsListResponse>('/locations', {
			params: {
				...(params.cursor ? { cursor: params.cursor } : {}),
				...(params.limit ? { limit: params.limit } : {}),
				...(params.search ? { search: params.search } : {}),
				...(params.isActive !== undefined
					? { isActive: params.isActive }
					: {}),
			},
		});

		return data;
	},

	async getById(id: string): Promise<Location> {
		const { data } = await http.get<Location>(`/locations/${id}`);
		return data;
	},

	async create(input: CreateLocationInput): Promise<Location> {
		const { data } = await http.post<Location>('/locations', input);
		return data;
	},

	async update(id: string, input: UpdateLocationInput): Promise<Location> {
		const { data } = await http.patch<Location>(`/locations/${id}`, input);
		return data;
	},

	async remove(id: string): Promise<{ success: true }> {
		const { data } = await http.delete<{ success: true }>(`/locations/${id}`);
		return data;
	},
};