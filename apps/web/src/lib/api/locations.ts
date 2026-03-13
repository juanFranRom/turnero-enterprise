import { http } from './http';
import type {
	CreateLocationInput,
	ListLocationsParams,
	ListLocationsResponse,
	Location,
	UpdateLocationInput,
} from '../../types/location';


export const locationsApi = {
	async list(params?: ListLocationsParams): Promise<ListLocationsResponse> {
		const { data } = await http.get<ListLocationsResponse>('/locations', {
			params,
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