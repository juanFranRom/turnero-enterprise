import type { PropsWithChildren } from 'react';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = PropsWithChildren<{
	variant?: BadgeVariant;
}>;

const variantClassName: Record<BadgeVariant, string> = {
	neutral: 'bg-slate-100 text-text-secondary',
	success: 'bg-[rgba(34,197,94,0.12)] text-success',
	warning: 'bg-[rgba(245,158,11,0.12)] text-warning',
	danger: 'bg-[rgba(239,68,68,0.12)] text-danger',
	info: 'bg-[rgba(34,193,241,0.12)] text-secondary',
};

export function Badge({
	children,
	variant = 'neutral',
}: BadgeProps) {
	return (
		<span
			className={[
				'inline-flex items-center rounded-full px-2.5 py-1 text-caption font-medium',
				variantClassName[variant],
			].join(' ')}
		>
			{children}
		</span>
	);
}