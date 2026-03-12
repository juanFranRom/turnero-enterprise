'use client';

import Link from 'next/link';
import { getApiErrorMessage } from '../../../lib/api/error-message';
import { canMutate } from '../../../lib/auth/permissions';
import { formatDate } from '../../../lib/i18n/format';
import { getLocationStatusLabel } from '../../../lib/i18n/location-labels';
import { useI18n } from '../../../lib/i18n/provider';
import { useT } from '../../../lib/i18n/use-t';
import { formatLocationAddress } from '../../../lib/locations/format-location-address';
import { useLocations } from '../../../hooks/use-locations';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/empty-state';
import { PageHeader } from '../../../components/ui/page-header';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeaderCell,
	TableRow,
} from '../../../components/ui/table';

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
	const { items, loading, error } = useLocations();

	const activeRole = getStoredActiveRole();
	const showCreate = canMutate(activeRole);

	if (loading) {
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
				description={t('locations.subtitle')}
				actions={
					showCreate ? (
						<Link href="/locations/new">
							<Button>{t('locations.actions.new')}</Button>
						</Link>
					) : null
				}
			/>

			{items.length === 0 ? (
				<EmptyState
					title={t('locations.empty.title')}
					description={t('locations.empty.subtitle')}
				>
					{showCreate ? (
						<Link href="/locations/new">
							<Button>{t('locations.actions.new')}</Button>
						</Link>
					) : null}
				</EmptyState>
			) : (
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
						</TableRow>
					</TableHead>

					<TableBody>
						{items.map((location) => {
							const address = formatLocationAddress(location);

							return (
								<TableRow key={location.id}>
									<TableCell className="font-medium">
										{location.name}
									</TableCell>

									<TableCell>
										{location.timeZone}
									</TableCell>

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
												location.isActive
													? 'success'
													: 'neutral'
											}
										>
											{getLocationStatusLabel(
												location.isActive,
												t
											)}
										</Badge>
									</TableCell>

									<TableCell>
										{formatDate(location.createdAt, locale)}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			)}
		</div>
	);
}