'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { PageHeader } from '../../../components/ui/page-header';
import { Select } from '../../../components/ui/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeaderCell,
	TableRow,
} from '../../../components/ui/table';
import { useDebouncedValue } from '../../../hooks/use-debounced-value';
import { useLocations } from '../../../hooks/use-locations';
import { locationsApi } from '../../../lib/api/locations';
import { getApiErrorMessage } from '../../../lib/api/error-message';
import { canMutate } from '../../../lib/auth/permissions';
import { formatDate } from '../../../lib/i18n/format';
import { getLocationStatusLabel } from '../../../lib/i18n/location-labels';
import { useI18n } from '../../../lib/i18n/provider';
import { useT } from '../../../lib/i18n/use-t';
import {
	parseCursorStack,
	serializeCursorStack,
} from '../../../lib/locations/location-pagination';
import {
	mapStatusFilterToApi,
	parseLocationSortDirection,
	parseLocationStatusFilter,
	type LocationSortDirection,
	type LocationStatusFilter,
} from '../../../lib/locations/location-filters';
import { formatLocationAddress } from '../../../lib/locations/format-location-address';
import { ConfirmDialog } from 'apps/web/src/components/ui/confirm-dialog';
import { getLocationEmptyState } from '../../../lib/locations/location-empty-state';

type ActiveRole = 'OWNER' | 'ADMIN' | 'STAFF' | null;

const getStoredActiveRole = (): ActiveRole => {
	if (typeof window === 'undefined') {
		return null;
	}

	const value = window.localStorage.getItem('timora.activeRole');

	if (value === 'OWNER' || value === 'ADMIN' || value === 'STAFF') {
		return value;
	}

	return null;
};

export default function LocationsPage() {
	const t = useT();
	const { locale } = useI18n();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const activeRole = getStoredActiveRole();
	const showMutations = canMutate(activeRole);

	const [isPending, startTransition] = useTransition();
	const [actionError, setActionError] = useState<string | null>(null);
	const [pendingActionId, setPendingActionId] = useState<string | null>(null);

	const search = searchParams.get('search') ?? '';
	const status = parseLocationStatusFilter(searchParams.get('status'));
	const direction = parseLocationSortDirection(searchParams.get('direction'));
	const cursor = searchParams.get('cursor') ?? undefined;
	const cursorStack = parseCursorStack(searchParams.get('cursorStack'));

	const [dialogState, setDialogState] = useState<{
		type: 'deactivate' | 'reactivate';
		locationId: string;
		locationName: string;
	} | null>(null);

	const [searchInput, setSearchInput] = useState(search);
	const debouncedSearch = useDebouncedValue(searchInput, 400);

	const {
		items,
		meta,
		initialLoading,
		isFetching,
		error,
		reload,
	} = useLocations({
		params: {
			limit: 20,
			cursor,
			search: search || undefined,
			isActive: mapStatusFilterToApi(status),
			direction,
		},
	});

	
	const emptyState = getLocationEmptyState({
		search,
		status,
		t,
	});

	const currentPage = cursorStack.length + 1;
	const canGoPrevious = cursorStack.length > 0;
	const canGoNext = Boolean(meta?.hasMore && meta?.nextCursor);

	const updateUrl = (next: {
		search?: string;
		status?: LocationStatusFilter;
		direction?: LocationSortDirection;
		cursor?: string | undefined;
		cursorStack?: string[];
	}) => {
		const params = new URLSearchParams(searchParams.toString());

		if (next.search !== undefined) {
			if (next.search.trim()) {
				params.set('search', next.search.trim());
			} else {
				params.delete('search');
			}
		}

		if (next.status !== undefined) {
			if (next.status === 'all') {
				params.delete('status');
			} else {
				params.set('status', next.status);
			}
		}

		if (next.direction !== undefined) {
			if (next.direction === 'desc') {
				params.delete('direction');
			} else {
				params.set('direction', next.direction);
			}
		}

		if (next.cursor !== undefined) {
			if (next.cursor) {
				params.set('cursor', next.cursor);
			} else {
				params.delete('cursor');
			}
		}

		if (next.cursorStack !== undefined) {
			const serializedStack = serializeCursorStack(next.cursorStack);

			if (serializedStack) {
				params.set('cursorStack', serializedStack);
			} else {
				params.delete('cursorStack');
			}
		}

		const query = params.toString();
		const nextUrl = query ? `${pathname}?${query}` : pathname;
		const currentUrl = searchParams.toString()
			? `${pathname}?${searchParams.toString()}`
			: pathname;

		if (nextUrl === currentUrl) {
			return;
		}

		router.replace(nextUrl);
	};

	const resetPagination = () => {
		return {
			cursor: undefined,
			cursorStack: [],
		};
	};

	const titleDescription = useMemo(() => {
		if (status === 'active') {
			return t('locations.filters.summary.active');
		}

		if (status === 'inactive') {
			return t('locations.filters.summary.inactive');
		}

		return t('locations.subtitle');
	}, [status, t]);

	const handleStatusChange = (nextStatus: LocationStatusFilter) => {
		startTransition(() => {
			updateUrl({
				search,
				status: nextStatus,
				direction,
				...resetPagination(),
			});
		});
	};

	const handleDirectionChange = (nextDirection: LocationSortDirection) => {
		startTransition(() => {
			updateUrl({
				search,
				status,
				direction: nextDirection,
				...resetPagination(),
			});
		});
	};

	const handleNextPage = () => {
		if (!meta?.nextCursor) {
			return;
		}

		startTransition(() => {
			updateUrl({
				search,
				status,
				direction,
				cursor: meta.nextCursor ?? undefined,
				cursorStack: [...cursorStack, cursor ?? ''],
			});
		});
	};

	const handlePreviousPage = () => {
		if (cursorStack.length === 0) {
			return;
		}

		const nextStack = cursorStack.slice(0, -1);
		const previousCursor = cursorStack[cursorStack.length - 1] || undefined;

		startTransition(() => {
			updateUrl({
				search,
				status,
				direction,
				cursor: previousCursor,
				cursorStack: nextStack,
			});
		});
	};

	const handleDeactivate = (locationId: string, locationName: string) => {
		setDialogState({
			type: 'deactivate',
			locationId,
			locationName,
		});
	};

	const handleReactivate = (locationId: string, locationName: string) => {
		setDialogState({
			type: 'reactivate',
			locationId,
			locationName,
		});
	};

	const handleConfirmDialog = async () => {
		if (!dialogState) {
			return;
		}

		try {
			setActionError(null);
			setPendingActionId(dialogState.locationId);

			if (dialogState.type === 'deactivate') {
				await locationsApi.remove(dialogState.locationId);
			} else {
				await locationsApi.update(dialogState.locationId, {
					isActive: true,
				});
			}

			setDialogState(null);
			await reload();
		} catch (err) {
			setActionError(getApiErrorMessage(err, t));
		} finally {
			setPendingActionId(null);
		}
	};

	useEffect(() => {
		setSearchInput(search);
	}, [search]);

	useEffect(() => {
		if (debouncedSearch === search) {
			return;
		}

		updateUrl({
			search: debouncedSearch,
			status,
			direction,
			...resetPagination(),
		});
	}, [debouncedSearch, direction, search, status]);

	if (initialLoading) {
		return (
			<div className="space-y-6">
				<PageHeader
					title={t('locations.title')}
					description={t('locations.subtitle')}
				/>

				<Card>
					<div className="text-small text-text-secondary">
						{t('locations.loading')}
					</div>
				</Card>
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-6">
				<PageHeader
					title={t('locations.title')}
					description={t('locations.subtitle')}
				/>

				<Card>
					<div className="text-small font-semibold text-danger">
						{t('locations.error.title')}
					</div>

					<p className="mt-2 text-small text-text-secondary">
						{getApiErrorMessage(error, t)}
					</p>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title={t('locations.title')}
				description={titleDescription}
				actions={
					showMutations ? (
						<Link href="/locations/new">
							<Button>{t('locations.actions.new')}</Button>
						</Link>
					) : null
				}
			/>

			<Card className="space-y-4">
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
					<Input
						name="search"
						value={searchInput}
						onChange={(event) => setSearchInput(event.target.value)}
						label={t('locations.filters.search.label')}
						placeholder={t('locations.filters.search.placeholder')}
					/>

					<Select
						label={t('locations.filters.status.label')}
						value={status}
						disabled={isPending}
						onValueChange={(nextValue) =>
							handleStatusChange(nextValue as LocationStatusFilter)
						}
						options={[
							{
								value: 'all',
								label: t('locations.filters.status.all'),
							},
							{
								value: 'active',
								label: t('locations.filters.status.active'),
							},
							{
								value: 'inactive',
								label: t('locations.filters.status.inactive'),
							},
						]}
					/>

					<Select
						label={t('locations.filters.direction.label')}
						value={direction}
						disabled={isPending}
						onValueChange={(nextValue) =>
							handleDirectionChange(nextValue as LocationSortDirection)
						}
						options={[
							{
								value: 'desc',
								label: t('locations.filters.direction.desc'),
							},
							{
								value: 'asc',
								label: t('locations.filters.direction.asc'),
							},
						]}
					/>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2">
					<Button
						variant="ghost"
						onClick={() => {
							setSearchInput('');
							updateUrl({
								search: '',
								status: 'all',
								direction: 'desc',
								...resetPagination(),
							});
						}}
					>
						{t('locations.filters.reset')}
					</Button>

					<div className="text-small text-text-secondary">
						{isFetching ? t('locations.loading') : '\u00A0'}
					</div>
				</div>
			</Card>

			{actionError ? (
				<Card>
					<div className="text-small font-semibold text-danger">
						{t('locations.actions.errorTitle')}
					</div>

					<p className="mt-2 text-small text-text-secondary">
						{actionError}
					</p>
				</Card>
			) : null}

			<div
				className={
					isFetching
						? 'transition-opacity duration-fast ease-timora opacity-70'
						: 'transition-opacity duration-fast ease-timora opacity-100'
				}
			>
				{items.length === 0 ? (
					<EmptyState
						title={emptyState.title}
						description={emptyState.description}
					>
						{showMutations && !search.trim() && status === 'all' ? (
							<Link href="/locations/new">
								<Button>{t('locations.actions.new')}</Button>
							</Link>
						) : null}
					</EmptyState>
				) : (
					<>
						<Table>
							<TableHead>
								<TableRow>
									<TableHeaderCell>
										{t('locations.table.name')}
									</TableHeaderCell>
									<TableHeaderCell>
										{t('locations.table.timeZone')}
									</TableHeaderCell>
									<TableHeaderCell>
										{t('locations.table.phone')}
									</TableHeaderCell>
									<TableHeaderCell>
										{t('locations.table.address')}
									</TableHeaderCell>
									<TableHeaderCell>
										{t('locations.table.status')}
									</TableHeaderCell>
									<TableHeaderCell>
										{t('locations.table.createdAt')}
									</TableHeaderCell>
									{showMutations ? (
										<TableHeaderCell className="w-[240px]">
											{t('locations.table.actions')}
										</TableHeaderCell>
									) : null}
								</TableRow>
							</TableHead>

							<TableBody>
								{items.map((location) => {
									const address = formatLocationAddress(location);
									const isPendingAction = pendingActionId === location.id;

									return (
										<TableRow key={location.id}>
											<TableCell className="font-medium">
												{location.name}
											</TableCell>

											<TableCell>{location.timeZone}</TableCell>

											<TableCell>
												{location.phone ?? (
													<span className="text-text-secondary">
														{t('locations.empty.phone')}
													</span>
												)}
											</TableCell>

											<TableCell>
												{address ?? (
													<span className="text-text-secondary">
														{t('locations.empty.address')}
													</span>
												)}
											</TableCell>

											<TableCell>
												<Badge
													variant={
														location.isActive ? 'success' : 'neutral'
													}
												>
													{getLocationStatusLabel(location.isActive, t)}
												</Badge>
											</TableCell>

											<TableCell>
												{formatDate(location.createdAt, locale)}
											</TableCell>

											{showMutations ? (
												<TableCell>
													<div className="flex items-center gap-2">
														<Link href={`/locations/${location.id}`}>
															<Button
																variant="ghost"
																disabled={isPendingAction}
															>
																{t('locations.actions.edit')}
															</Button>
														</Link>

														{location.isActive ? (
															<Button
																variant="ghost"
																disabled={isPendingAction}
																onClick={() =>
																	handleDeactivate(
																		location.id,
																		location.name
																	)
																}
															>
																{isPendingAction
																	? t(
																			'locations.actions.deactivating'
																		)
																	: t(
																			'locations.actions.deactivate'
																		)}
															</Button>
														) : (
															<Button
																variant="ghost"
																disabled={isPendingAction}
																onClick={() =>
																	handleReactivate(
																		location.id,
																		location.name
																	)
																}
															>
																{isPendingAction
																	? t(
																			'locations.actions.reactivating'
																		)
																	: t(
																			'locations.actions.reactivate'
																		)}
															</Button>
														)}
													</div>
												</TableCell>
											) : null}
										</TableRow>
									);
								})}
							</TableBody>
						</Table>

						<div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="text-small text-text-secondary">
								{t('locations.pagination.page').replace(
									'{page}',
									String(currentPage)
								)}
							</div>

							<div className="flex items-center gap-2">
								<Button
									variant="ghost"
									disabled={!canGoPrevious || isPending || isFetching}
									onClick={handlePreviousPage}
								>
									{t('locations.pagination.previous')}
								</Button>

								<Button
									variant="ghost"
									disabled={!canGoNext || isPending || isFetching}
									onClick={handleNextPage}
								>
									{t('locations.pagination.next')}
								</Button>
							</div>
						</div>
					</>
				)}
			</div>
			<ConfirmDialog
				open={Boolean(dialogState)}
				title={
					dialogState?.type === 'deactivate'
						? t('locations.dialogs.deactivate.title')
						: t('locations.dialogs.reactivate.title')
				}
				description={
					dialogState
						? (
								dialogState.type === 'deactivate'
									? t('locations.dialogs.deactivate.description')
									: t('locations.dialogs.reactivate.description')
							).replace('{name}', dialogState.locationName)
						: undefined
				}
				confirmLabel={
					dialogState?.type === 'deactivate'
						? t('locations.dialogs.deactivate.confirm')
						: t('locations.dialogs.reactivate.confirm')
				}
				cancelLabel={t('common.cancel')}
				confirmVariant={dialogState?.type === 'deactivate' ? 'danger' : 'primary'}
				loading={Boolean(dialogState && pendingActionId === dialogState.locationId)}
				onCancel={() => setDialogState(null)}
				onConfirm={handleConfirmDialog}
			/>
		</div>
	);
}