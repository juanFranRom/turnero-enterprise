'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '../../../lib/api/auth';
import { ApiClientError } from '../../../lib/api/errors';
import { sessionStore } from '../../../lib/auth/session-store';
import { useT } from '../../../lib/i18n/use-t';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { getApiErrorMessage } from 'apps/web/src/lib/api/error-message';

type FormState = {
	email: string;
	password: string;
};

export default function LoginPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const t = useT();

	const nextPath = useMemo(
		() => searchParams.get('next') || '/dashboard',
		[searchParams]
	);

	const [form, setForm] = useState<FormState>({
		email: '',
		password: '',
	});
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setSubmitting(true);

		try {
			const result = await authApi.login(form);

			if (result.activeTenantSlug) {
				sessionStore.setActiveTenantSlug(result.activeTenantSlug);
			}

			router.replace(nextPath);
			router.refresh();
		} catch (err) {
			setError(getApiErrorMessage(err, t));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-bg px-4">
			<Card className="w-full max-w-md p-8 shadow-floating">
				<div className="mb-8">
					<div className="inline-flex rounded-full bg-brand-gradient px-3 py-1 text-caption font-semibold uppercase tracking-[0.18em] text-white">
						Timora
					</div>

					<h1 className="mt-4 text-h2 text-text-primary">
						{t('auth.login.title')}
					</h1>

					<p className="mt-2 text-small text-text-secondary">
						{t('auth.login.subtitle')}
					</p>
				</div>

				<form className="flex flex-col gap-4" onSubmit={onSubmit}>
					<Input
						label={t('auth.login.email')}
						type="email"
						autoComplete="email"
						value={form.email}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								email: event.target.value,
							}))
						}
						required
					/>

					<Input
						label={t('auth.login.password')}
						type="password"
						autoComplete="current-password"
						value={form.password}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								password: event.target.value,
							}))
						}
						required
					/>

					{error ? (
						<div className="rounded-md border border-danger bg-[rgba(239,68,68,0.06)] px-3 py-2 text-small text-danger">
							{error}
						</div>
					) : null}

					<Button type="submit" fullWidth disabled={submitting}>
						{submitting
							? t('auth.login.submitting')
							: t('auth.login.submit')}
					</Button>
				</form>
			</Card>
		</div>
	);
}