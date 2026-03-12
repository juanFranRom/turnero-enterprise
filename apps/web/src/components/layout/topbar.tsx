'use client';

import { useRouter } from 'next/navigation';
import { authApi } from '../../lib/api/auth';
import { useI18n } from '../../lib/i18n/provider';
import { useT } from '../../lib/i18n/use-t';
import { getRoleLabel } from '../../lib/i18n/domain-labels';
import type { AppLocale } from '../../types/i18n';
import type { AuthUser, UserRole } from '../../types/auth';
import { Button } from '../ui/button';

type TopbarProps = {
	user: AuthUser;
	activeRole: UserRole;
	activeTenantSlug: string | null;
};

export function Topbar({
	user,
	activeRole,
	activeTenantSlug,
}: TopbarProps) {
	const router = useRouter();
	const t = useT();
	const { locale, setLocale } = useI18n();

	const handleLogout = async () => {
		await authApi.logout();
		router.replace('/login');
		router.refresh();
	};

	return (
		<header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
			<div className="flex flex-col">
				<span className="text-caption uppercase tracking-[0.18em] text-text-secondary">
					{t('topbar.tenant')}
				</span>
				<span className="text-small font-semibold text-text-primary">
					{activeTenantSlug ?? t('topbar.noActiveTenant')}
				</span>
			</div>

			<div className="flex items-center gap-3">
				<select
					value={locale}
					onChange={(event) => setLocale(event.target.value as AppLocale)}
					className="h-10 rounded-button border border-border bg-card px-3 text-small text-text-primary outline-none transition-all duration-fast ease-timora focus:border-primary focus:ring-2 focus:ring-[rgba(91,93,240,0.15)]"
				>
					<option value="es-AR">ES</option>
					<option value="en">EN</option>
				</select>

				<div className="hidden text-right sm:block">
					<div className="text-small font-semibold text-text-primary">
						{getRoleLabel(activeRole, t)}
					</div>
					<div className="text-caption text-text-secondary">
						{user.email}
					</div>
				</div>

				<Button variant="secondary" onClick={handleLogout}>
					{t('common.actions.logout')}
				</Button>
			</div>
		</header>
	);
}