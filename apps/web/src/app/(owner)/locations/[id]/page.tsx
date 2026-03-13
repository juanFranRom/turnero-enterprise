'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LocationForm } from '../../../../components/locations/location-form';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { PageHeader } from '../../../../components/ui/page-header';
import { locationsApi } from '../../../../lib/api/locations';
import { getApiErrorMessage } from '../../../../lib/api/error-message';
import { canMutate } from '../../../../lib/auth/permissions';
import { useT } from '../../../../lib/i18n/use-t';
import type { UserRole } from '../../../../types/auth';
import type { Location, UpdateLocationInput } from '../../../../types/location';

const getStoredActiveRole = (): UserRole | null => {
	if (typeof window === 'undefined') {
		return null;
	}

	const value = window.localStorage.getItem('timora.activeRole');

	if (value === 'OWNER' || value === 'ADMIN' || value === 'STAFF') {
		return value;
	}

	return null;
};

export default function EditLocationPage() {
	const t = useT();
	const router = useRouter();
	const params = useParams<{ id: string }>();

	const [location, setLocation] = useState<Location | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const activeRole = getStoredActiveRole();
	const canEdit = canMutate(activeRole);

	useEffect(() => {
		let mounted = true;

		const load = async () => {
			try {
				setLoading(true);
				setLoadError(null);

				const response = await locationsApi.getById(params.id);

				if (!mounted) {
					return;
				}

				setLocation(response);
			} catch (error) {
				if (!mounted) {
					return;
				}

				setLoadError(getApiErrorMessage(error, t));
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		};

		void load();

		return () => {
			mounted = false;
		};
	}, [params.id, t]);

	const handleSubmit = async (input: UpdateLocationInput) => {
		try {
			setSubmitting(true);
			setSubmitError(null);

			await locationsApi.update(params.id, input);

			router.push('/locations');
			router.refresh();
		} catch (error) {
			setSubmitError(getApiErrorMessage(error, t));
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<PageHeader
					eyebrow={t('locations.title')}
					title={t('locations.edit.title')}
					description={t('locations.loadingOne')}
				/>

				<Card>
					<div className="text-small text-text-secondary">
						{t('locations.loadingOne')}
					</div>
				</Card>
			</div>
		);
	}

	if (loadError || !location) {
		return (
			<div className="space-y-6">
				<PageHeader
					eyebrow={t('locations.title')}
					title={t('locations.edit.title')}
					description={t('locations.edit.subtitle')}
				/>

				<Card className="space-y-4">
					<div className="text-small font-semibold text-danger">
						{t('locations.error.loadOneTitle')}
					</div>

					<p className="text-small text-text-secondary">
						{loadError ?? t('errors.generic')}
					</p>

					<div>
						<Button variant="ghost" onClick={() => router.push('/locations')}>
							{t('locations.form.actions.back')}
						</Button>
					</div>
				</Card>
			</div>
		);
	}

	if (!canEdit) {
		return (
			<div className="space-y-6">
				<PageHeader
					eyebrow={t('locations.title')}
					title={location.name}
					description={t('locations.rbac.readOnly')}
				/>

				<Card className="space-y-4">
					<p className="text-small text-text-secondary">
						{t('locations.rbac.readOnly')}
					</p>

					<div>
						<Button variant="ghost" onClick={() => router.push('/locations')}>
							{t('locations.form.actions.back')}
						</Button>
					</div>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				eyebrow={t('locations.title')}
				title={t('locations.edit.title')}
				description={t('locations.edit.subtitle')}
			/>

			<LocationForm
				mode="edit"
				initialValue={location}
				submitting={submitting}
				submitError={submitError}
				onSubmit={handleSubmit}
				onCancel={() => router.push('/locations')}
			/>
		</div>
	);
}