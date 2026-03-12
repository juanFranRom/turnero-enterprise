'use client';

import type { PropsWithChildren } from 'react';
import type { AuthUser, UserRole } from '../../types/auth';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

type AppShellProps = PropsWithChildren<{
	user: AuthUser;
	activeRole: UserRole;
	activeTenantSlug: string | null;
}>;

export function AppShell({
	user,
	activeRole,
	activeTenantSlug,
	children,
}: AppShellProps) {
	return (
		<div className="flex min-h-screen bg-bg text-text-primary">
			<Sidebar role={activeRole} />

			<div className="flex min-h-screen min-w-0 flex-1 flex-col">
				<Topbar
					user={user}
					activeRole={activeRole}
					activeTenantSlug={activeTenantSlug}
				/>
				<main className="flex-1 p-4 lg:p-6">{children}</main>
			</div>
		</div>
	);
}