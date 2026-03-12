import type { HTMLAttributes, PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function Card({ children, className = '', ...props }: CardProps) {
	return (
		<div
			className={[
				'rounded-card border border-border bg-card p-6 shadow-card',
				className,
			]
				.filter(Boolean)
				.join(' ')}
			{...props}
		>
			{children}
		</div>
	);
}