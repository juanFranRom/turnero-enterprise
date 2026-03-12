import type { PropsWithChildren, TableHTMLAttributes } from 'react';

export function Table({
	children,
	className = '',
	...props
}: PropsWithChildren<TableHTMLAttributes<HTMLTableElement>>) {
	return (
		<div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
			<div className="overflow-x-auto">
				<table
					className={[
						'min-w-full border-collapse',
						className,
					]
						.filter(Boolean)
						.join(' ')}
					{...props}
				>
					{children}
				</table>
			</div>
		</div>
	);
}

export function TableHead({
	children,
	className = '',
}: PropsWithChildren<{ className?: string }>) {
	return (
		<thead className={className}>
			{children}
		</thead>
	);
}

export function TableBody({
	children,
	className = '',
}: PropsWithChildren<{ className?: string }>) {
	return (
		<tbody className={className}>
			{children}
		</tbody>
	);
}

export function TableRow({
	children,
	className = '',
}: PropsWithChildren<{ className?: string }>) {
	return (
		<tr
			className={[
				'border-b border-border last:border-b-0',
				className,
			]
				.filter(Boolean)
				.join(' ')}
		>
			{children}
		</tr>
	);
}

export function TableHeaderCell({
	children,
	className = '',
}: PropsWithChildren<{ className?: string }>) {
	return (
		<th
			className={[
				'bg-bg px-4 py-3 text-left text-caption font-semibold uppercase tracking-[0.12em] text-text-secondary',
				className,
			]
				.filter(Boolean)
				.join(' ')}
		>
			{children}
		</th>
	);
}

export function TableCell({
	children,
	className = '',
}: PropsWithChildren<{ className?: string }>) {
	return (
		<td
			className={[
				'px-4 py-3 text-small text-text-primary',
				className,
			]
				.filter(Boolean)
				.join(' ')}
		>
			{children}
		</td>
	);
}