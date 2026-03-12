'use client';

import { useEffect, useState } from 'react';
import { locationsApi } from '../lib/api/locations';
import type { Location } from '../types/location';

type UseLocationsState = {
	items: Location[];
	nextCursor: string | null;
	loading: boolean;
	error: unknown | null;
};

export function useLocations() {
	const [state, setState] = useState<UseLocationsState>({
		items: [],
		nextCursor: null,
		loading: true,
		error: null,
	});

	useEffect(() => {
		let mounted = true;

		const run = async () => {
			try {
				const data = await locationsApi.list({ limit: 20 });

				if (!mounted) {
					return;
				}

				setState({
					items: data.items,
					nextCursor: data.nextCursor,
					loading: false,
					error: null,
				});
			} catch (error) {
				if (!mounted) {
					return;
				}

				setState({
					items: [],
					nextCursor: null,
					loading: false,
					error,
				});
			}
		};

		void run();

		return () => {
			mounted = false;
		};
	}, []);

	return state;
}