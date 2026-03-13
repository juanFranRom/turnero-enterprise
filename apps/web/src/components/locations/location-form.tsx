'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { useT } from '../../lib/i18n/use-t';
import type {
	CreateLocationInput,
	Location,
	UpdateLocationInput,
} from '../../types/location';

type TranslateFn = (key: string) => string;

type LocationFormValues = {
	name: string;
	timeZone: string;
	isActive: boolean;
	phone: string;
	addressLine1: string;
	addressLine2: string;
	city: string;
	state: string;
	postalCode: string;
};

type LocationFormErrors = Partial<Record<keyof LocationFormValues, string>>;

type LocationFormProps = {
	mode: 'create' | 'edit';
	initialValue?: Location | null;
	submitting?: boolean;
	submitError?: string | null;
	onSubmit: (input: CreateLocationInput | UpdateLocationInput) => Promise<void> | void;
	onCancel?: () => void;
};

const DEFAULT_TIME_ZONE = 'America/Argentina/San_Luis';

const toFormValues = (location?: Location | null): LocationFormValues => {
	return {
		name: location?.name ?? '',
		timeZone: location?.timeZone ?? DEFAULT_TIME_ZONE,
		isActive: location?.isActive ?? true,
		phone: location?.phone ?? '',
		addressLine1: location?.addressLine1 ?? '',
		addressLine2: location?.addressLine2 ?? '',
		city: location?.city ?? '',
		state: location?.state ?? '',
		postalCode: location?.postalCode ?? '',
	};
};

const normalizeOptional = (value: string): string | undefined => {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const validate = (
	values: LocationFormValues,
	t: TranslateFn
): LocationFormErrors => {
	const errors: LocationFormErrors = {};

	const name = values.name.trim();
	const timeZone = values.timeZone.trim();
	const phone = values.phone.trim();
	const addressLine1 = values.addressLine1.trim();
	const addressLine2 = values.addressLine2.trim();
	const city = values.city.trim();
	const state = values.state.trim();
	const postalCode = values.postalCode.trim();

	if (name.length < 2 || name.length > 80) {
		errors.name = t('locations.form.validation.name');
	}

	if (timeZone.length < 2 || timeZone.length > 64) {
		errors.timeZone = t('locations.form.validation.timeZone');
	}

	if (phone.length > 0 && (phone.length < 3 || phone.length > 40)) {
		errors.phone = t('locations.form.validation.phone');
	}

	if (
		addressLine1.length > 0 &&
		(addressLine1.length < 3 || addressLine1.length > 120)
	) {
		errors.addressLine1 = t('locations.form.validation.addressLine1');
	}

	if (addressLine2.length > 120) {
		errors.addressLine2 = t('locations.form.validation.addressLine2');
	}

	if (city.length > 0 && (city.length < 2 || city.length > 80)) {
		errors.city = t('locations.form.validation.city');
	}

	if (state.length > 0 && (state.length < 2 || state.length > 80)) {
		errors.state = t('locations.form.validation.state');
	}

	if (
		postalCode.length > 0 &&
		(postalCode.length < 2 || postalCode.length > 20)
	) {
		errors.postalCode = t('locations.form.validation.postalCode');
	}

	return errors;
};

const buildPayload = (
	mode: 'create' | 'edit',
	values: LocationFormValues
): CreateLocationInput | UpdateLocationInput => {
	const payload: CreateLocationInput | UpdateLocationInput = {
		name: values.name.trim(),
		timeZone: values.timeZone.trim(),
		isActive: values.isActive,
	};

	const phone = normalizeOptional(values.phone);
	const addressLine1 = normalizeOptional(values.addressLine1);
	const addressLine2 = normalizeOptional(values.addressLine2);
	const city = normalizeOptional(values.city);
	const state = normalizeOptional(values.state);
	const postalCode = normalizeOptional(values.postalCode);

	if (phone !== undefined) {
		payload.phone = phone;
	}

	if (addressLine1 !== undefined) {
		payload.addressLine1 = addressLine1;
	}

	if (addressLine2 !== undefined) {
		payload.addressLine2 = addressLine2;
	}

	if (city !== undefined) {
		payload.city = city;
	}

	if (state !== undefined) {
		payload.state = state;
	}

	if (postalCode !== undefined) {
		payload.postalCode = postalCode;
	}

	if (mode === 'edit') {
		return payload as UpdateLocationInput;
	}

	return payload as CreateLocationInput;
};

export function LocationForm({
	mode,
	initialValue,
	submitting = false,
	submitError,
	onSubmit,
	onCancel,
}: LocationFormProps) {
	const t = useT();
	const [values, setValues] = useState<LocationFormValues>(() =>
		toFormValues(initialValue)
	);
	const [errors, setErrors] = useState<LocationFormErrors>({});

	const setField = <K extends keyof LocationFormValues>(
		key: K,
		value: LocationFormValues[K]
	) => {
		setValues((current) => ({
			...current,
			[key]: value,
		}));

		setErrors((current) => {
			if (!current[key]) {
				return current;
			}

			const next = { ...current };
			delete next[key];
			return next;
		});
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const nextErrors = validate(values, t);

		if (Object.keys(nextErrors).length > 0) {
			setErrors(nextErrors);
			return;
		}

		await onSubmit(buildPayload(mode, values));
	};

	return (
		<Card className="space-y-6">
			<form className="space-y-6" onSubmit={handleSubmit}>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Input
						label={t('locations.form.name')}
						value={values.name}
						onChange={(event) => setField('name', event.target.value)}
						error={errors.name}
						placeholder={t('locations.form.placeholders.name')}
						autoComplete="organization"
					/>

					<Input
						label={t('locations.form.timeZone')}
						value={values.timeZone}
						onChange={(event) => setField('timeZone', event.target.value)}
						error={errors.timeZone}
						placeholder={t('locations.form.placeholders.timeZone')}
						autoComplete="off"
					/>

					<Input
						label={t('locations.form.phone')}
						value={values.phone}
						onChange={(event) => setField('phone', event.target.value)}
						error={errors.phone}
						placeholder={t('locations.form.placeholders.phone')}
						autoComplete="tel"
					/>

					<Select
						label={t('locations.form.status')}
						value={values.isActive ? 'active' : 'inactive'}
						onValueChange={(nextValue) =>
							setField('isActive', nextValue === 'active')
						}
						options={[
							{
								value: 'active',
								label: t('locations.status.active'),
							},
							{
								value: 'inactive',
								label: t('locations.status.inactive'),
							},
						]}
					/>
				</div>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Input
						label={t('locations.form.addressLine1')}
						value={values.addressLine1}
						onChange={(event) =>
							setField('addressLine1', event.target.value)
						}
						error={errors.addressLine1}
						placeholder={t('locations.form.placeholders.addressLine1')}
						autoComplete="address-line1"
					/>

					<Input
						label={t('locations.form.addressLine2')}
						value={values.addressLine2}
						onChange={(event) =>
							setField('addressLine2', event.target.value)
						}
						error={errors.addressLine2}
						placeholder={t('locations.form.placeholders.addressLine2')}
						autoComplete="address-line2"
					/>

					<Input
						label={t('locations.form.city')}
						value={values.city}
						onChange={(event) => setField('city', event.target.value)}
						error={errors.city}
						placeholder={t('locations.form.placeholders.city')}
						autoComplete="address-level2"
					/>

					<Input
						label={t('locations.form.state')}
						value={values.state}
						onChange={(event) => setField('state', event.target.value)}
						error={errors.state}
						placeholder={t('locations.form.placeholders.state')}
						autoComplete="address-level1"
					/>

					<Input
						label={t('locations.form.postalCode')}
						value={values.postalCode}
						onChange={(event) =>
							setField('postalCode', event.target.value)
						}
						error={errors.postalCode}
						placeholder={t('locations.form.placeholders.postalCode')}
						autoComplete="postal-code"
					/>
				</div>

				{submitError ? (
					<div className="rounded-button border border-danger/20 bg-[rgba(239,68,68,0.06)] px-4 py-3 text-small text-danger">
						{submitError}
					</div>
				) : null}

				<div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
					{onCancel ? (
						<Button
							type="button"
							variant="ghost"
							onClick={onCancel}
							disabled={submitting}
						>
							{t('locations.form.actions.cancel')}
						</Button>
					) : null}

					<Button type="submit" disabled={submitting}>
						{submitting
							? mode === 'create'
								? t('locations.form.actions.creating')
								: t('locations.form.actions.saving')
							: mode === 'create'
								? t('locations.form.actions.create')
								: t('locations.form.actions.save')}
					</Button>
				</div>
			</form>
		</Card>
	);
}