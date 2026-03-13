'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocationForm } from '../../../../components/locations/location-form';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { PageHeader } from '../../../../components/ui/page-header';
import { locationsApi } from '../../../../lib/api/locations';
import { getApiErrorMessage } from '../../../../lib/api/error-message';
import { canMutate } from '../../../../lib/auth/permissions';
import { useT } from '../../../../lib/i18n/use-t';
import type { UserRole } from '../../../../types/auth';
import type { CreateLocationInput } from '../../../../types/location';

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

export default function NewLocationPage() {
	const t = useT();
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const activeRole = getStoredActiveRole();
	const canCreate = canMutate(activeRole);

	const handleSubmit = async (input: CreateLocationInput) => {
		try {
			setSubmitting(true);
			setSubmitError(null);

			await locationsApi.create(input);

			router.push('/locations');
			router.refresh();
		} catch (error) {
			setSubmitError(getApiErrorMessage(error, t));
		} finally {
			setSubmitting(false);
		}
	};

	if (!canCreate) {
		return (
			<div className="space-y-6">
				<PageHeader
					eyebrow={t('locations.title')}
					title={t('locations.create.title')}
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
				title={t('locations.create.title')}
				description={t('locations.create.subtitle')}
			/>

			<LocationForm
				mode="create"
				submitting={submitting}
				submitError={submitError}
				onSubmit={handleSubmit}
				onCancel={() => router.push('/locations')}
			/>
		</div>
	);
}