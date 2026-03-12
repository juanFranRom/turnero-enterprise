'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '../../lib/i18n/use-t';
import type { UserRole } from '../../types/auth';

type NavItem = {
	href: string;
	labelKey: string;
	roles: UserRole[];
};

const navItems: NavItem[] = [
	{
		href: '/dashboard',
		labelKey: 'sidebar.dashboard',
		roles: ['OWNER', 'ADMIN', 'STAFF'],
	},
	{
		href: '/locations',
		labelKey: 'sidebar.locations',
		roles: ['OWNER', 'ADMIN', 'STAFF'],
	},
	{
		href: '/resources',
		labelKey: 'sidebar.resources',
		roles: ['OWNER', 'ADMIN', 'STAFF'],
	},
	{
		href: '/services',
		labelKey: 'sidebar.services',
		roles: ['OWNER', 'ADMIN', 'STAFF'],
	},
	{
		href: '/resource-services',
		labelKey: 'sidebar.resourceServices',
		roles: ['OWNER', 'ADMIN', 'STAFF'],
	},
	{
		href: '/weekly-schedules',
		labelKey: 'sidebar.weeklySchedules',
		roles: ['OWNER', 'ADMIN', 'STAFF'],
	},
	{
		href: '/availability-overrides',
		labelKey: 'sidebar.availabilityOverrides',
		roles: ['OWNER', 'ADMIN', 'STAFF'],
	},
	{
		href: '/appointments',
		labelKey: 'sidebar.appointments',
		roles: ['OWNER', 'ADMIN', 'STAFF'],
	},
];

type SidebarProps = {
	role: UserRole;
};

export function Sidebar({ role }: SidebarProps) {
	const pathname = usePathname();
	const t = useT();

	return (
		<aside className="hidden w-72 shrink-0 border-r border-border bg-card lg:block">
			<div className="flex h-16 items-center border-b border-border px-6">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient text-white shadow-card">
						T
					</div>

					<div className="flex flex-col">
						<span className="text-h3 text-text-primary">
							{t('sidebar.productName')}
						</span>
						<span className="text-caption uppercase tracking-[0.18em] text-text-secondary">
							{t('sidebar.productArea')}
						</span>
					</div>
				</div>
			</div>

			<nav className="flex flex-col gap-1 p-4">
				{navItems
					.filter((item) => item.roles.includes(role))
					.map((item) => {
						const active =
							pathname === item.href ||
							pathname.startsWith(`${item.href}/`);

						return (
							<Link
								key={item.href}
								href={item.href}
								className={[
									'rounded-md px-3 py-2.5 text-small font-medium transition-all duration-fast ease-timora',
									active
										? 'bg-sidebar-active text-primary'
										: 'text-text-secondary hover:bg-slate-50 hover:text-text-primary',
								].join(' ')}
							>
								{t(item.labelKey)}
							</Link>
						);
					})}
			</nav>
		</aside>
	);
}