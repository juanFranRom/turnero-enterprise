'use client';

import { useEffect, useState, type PropsWithChildren } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authApi } from '../../lib/api/auth';
import { ApiClientError } from '../../lib/api/errors';
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

export function AuthGuard({ children }: PropsWithChildren) {
	const router = useRouter();
	const pathname = usePathname();
	const t = useT();

	const [auth, setAuth] = useState<AuthContext | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		const bootstrap = async () => {
			try {
				let token = sessionStore.getAccessToken();

				if (!token) {
					const refreshResponse = await authApi.refresh();
					token = refreshResponse.accessToken;

					if (refreshResponse.activeTenantSlug) {
						sessionStore.setActiveTenantSlug(
							refreshResponse.activeTenantSlug
						);
					}
				}

				const me = await authApi.me();

				if (me.activeTenantSlug) {
					sessionStore.setActiveTenantSlug(me.activeTenantSlug);
				}

				const activeRole = resolveActiveRole(me);

				if (!canViewOwnerModules(activeRole)) {
					await authApi.logout();
					sessionStore.clear();

					if (typeof window !== 'undefined') {
						window.localStorage.removeItem('timora.activeRole');
					}

					router.replace('/login');
					return;
				}

				if (typeof window !== 'undefined' && activeRole) {
					window.localStorage.setItem('timora.activeRole', activeRole);
				}

				if (mounted) {
					setAuth(me);
				}
			} catch (error) {
				if (error instanceof ApiClientError) {
					if (error.status === 401 || error.status === 403) {
						sessionStore.clear();

						if (typeof window !== 'undefined') {
							window.localStorage.removeItem('timora.activeRole');
						}

						router.replace(`/login?next=${encodeURIComponent(pathname)}`);
						return;
					}
				}

				if (mounted) {
					setAuth(null);
				}
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