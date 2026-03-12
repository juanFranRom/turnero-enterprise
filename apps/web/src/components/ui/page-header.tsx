import type { PropsWithChildren, ReactNode } from 'react';

type PageHeaderProps = PropsWithChildren<{
	eyebrow?: string;
	title: string;
	description?: string;
	actions?: ReactNode;
}>;

export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
}: PageHeaderProps) {
	return (
		<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div>
				{eyebrow ? (
					<div className="text-caption uppercase tracking-[0.18em] text-text-secondary">
						{eyebrow}
					</div>
				) : null}

				<h1 className="mt-2 text-h2 text-text-primary">{title}</h1>

				{description ? (
					<p className="mt-2 text-small text-text-secondary">
						{description}
					</p>
				) : null}
			</div>

			{actions ? <div>{actions}</div> : null}
		</div>
	);
}