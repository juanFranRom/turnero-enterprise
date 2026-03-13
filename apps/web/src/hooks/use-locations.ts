'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { locationsApi } from '../lib/api/locations';
import type {
	ListLocationsParams,
	ListLocationsResponse,
	Location,
} from '../types/location';

type UseLocationsOptions = {
	params?: ListLocationsParams;
};

export function useLocations({ params }: UseLocationsOptions = {}) {
	const [items, setItems] = useState<Location[]>([]);
	const [meta, setMeta] = useState<ListLocationsResponse['meta'] | null>(null);
	const [initialLoading, setInitialLoading] = useState(true);
	const [isFetching, setIsFetching] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const hasLoadedOnceRef = useRef(false);

	const load = useCallback(async () => {
		try {
			setError(null);

			if (!hasLoadedOnceRef.current) {
				setInitialLoading(true);
			} else {
				setIsFetching(true);
			}

			const response = await locationsApi.list({
				limit: params?.limit ?? 20,
				cursor: params?.cursor,
				search: params?.search,
				isActive: params?.isActive,
				direction: params?.direction ?? 'desc',
			});

			setItems(response.items);
			setMeta(response.meta);
			hasLoadedOnceRef.current = true;
		} catch (err) {
			setError(err);
		} finally {
			setInitialLoading(false);
			setIsFetching(false);
		}
	}, [
		params?.cursor,
		params?.direction,
		params?.isActive,
		params?.limit,
		params?.search,
	]);

	useEffect(() => {
		void load();
	}, [load]);

	return {
		items,
		meta,
		initialLoading,
		isFetching,
		error,
		reload: load,
	};
}