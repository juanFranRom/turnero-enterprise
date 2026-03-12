import type { PropsWithChildren } from 'react';

type EmptyStateProps = PropsWithChildren<{
	title: string;
	description?: string;
}>;

export function EmptyState({
	title,
	description,
	children,
}: EmptyStateProps) {
	return (
		<div className="rounded-card border border-dashed border-border bg-card p-8 text-center shadow-card">
			<h2 className="text-h3 text-text-primary">{title}</h2>

			{description ? (
				<p className="mt-2 text-small text-text-secondary">
					{description}
				</p>
			) : null}

			{children ? (
				<div className="mt-6 flex justify-center">
					{children}
				</div>
			) : null}
		</div>
	);
}