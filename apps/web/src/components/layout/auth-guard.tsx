'use client';

import { useEffect, useState, type PropsWithChildren } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import { authApi } from '../../lib/api/auth';
import { sessionStore } from '../../lib/auth/session-store';
import { canViewOwnerModules } from '../../lib/auth/permissions';
import { useT } from '../../lib/i18n/use-t';
import type { AuthContext, UserRole } from '../../types/auth';
import { AppShell } from './app-shell';

const resolveActiveRole = (auth: AuthContext): UserRole | null => {
	if (!auth.memberships.length) {
		return null;
	}

	if (auth.activeTenantSlug) {
		const activeMembership = auth.memberships.find(
			(membership) => membership.tenantSlug === auth.activeTenantSlug
		);

		if (activeMembership) {
			return activeMembership.role;
		}
	}

	return auth.memberships[0]?.role ?? null;
};

const clearClientSession = () => {
	sessionStore.clear();

	if (typeof window !== 'undefined') {
		window.localStorage.removeItem('timora.activeRole');
	}
};

const getErrorStatus = (error: unknown): number | null => {
	if (axios.isAxiosError(error)) {
		return error.response?.status ?? null;
	}

	if (
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		typeof (error as { status?: unknown }).status === 'number'
	) {
		return (error as { status: number }).status;
	}

	return null;
};

export function AuthGuard({ children }: PropsWithChildren) {
	const router = useRouter();
	const pathname = usePathname();
	const t = useT();

	const [auth, setAuth] = useState<AuthContext | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		const loadMe = async () => {
			const me = await authApi.me();

			if (me.activeTenantSlug) {
				sessionStore.setActiveTenantSlug(me.activeTenantSlug);
			}

			const activeRole = resolveActiveRole(me);

			if (!canViewOwnerModules(activeRole)) {
				await authApi.logout();
				clearClientSession();
				router.replace('/login');
				return null;
			}

			if (typeof window !== 'undefined' && activeRole) {
				window.localStorage.setItem('timora.activeRole', activeRole);
			}

			return me;
		};

		const bootstrap = async () => {
			try {
				const storedToken = sessionStore.getAccessToken();

				if (!storedToken) {
					const refreshResponse = await authApi.refresh();
					sessionStore.setAccessToken(refreshResponse.accessToken);

					if (refreshResponse.activeTenantSlug) {
						sessionStore.setActiveTenantSlug(
							refreshResponse.activeTenantSlug
						);
					}
				}

				const me = await loadMe();

				if (mounted) {
					setAuth(me);
				}
			} catch (error) {
				const status = getErrorStatus(error);

				if (status === 401) {
					try {
						const refreshResponse = await authApi.refresh();
						sessionStore.setAccessToken(refreshResponse.accessToken);

						if (refreshResponse.activeTenantSlug) {
							sessionStore.setActiveTenantSlug(
								refreshResponse.activeTenantSlug
							);
						}

						const me = await loadMe();

						if (mounted) {
							setAuth(me);
						}

						return;
					} catch {
						clearClientSession();
						router.replace(`/login?next=${encodeURIComponent(pathname)}`);
						return;
					}
				}

				if (status === 403) {
					clearClientSession();
					router.replace(`/login?next=${encodeURIComponent(pathname)}`);
					return;
				}

				clearClientSession();
				router.replace(`/login?next=${encodeURIComponent(pathname)}`);
				return;
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		};

		void bootstrap();

		return () => {
			mounted = false;
		};
	}, [pathname, router]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-bg">
				<div className="rounded-card border border-border bg-card px-6 py-4 text-small text-text-secondary shadow-card">
					{t('common.loadingWorkspace')}
				</div>
			</div>
		);
	}

	if (!auth) {
		return null;
	}

	const activeRole = resolveActiveRole(auth);

	if (!activeRole) {
		return null;
	}

	return (
		<AppShell
			user={auth.user}
			activeRole={activeRole}
			activeTenantSlug={auth.activeTenantSlug}
		>
			{children}
		</AppShell>
	);
}