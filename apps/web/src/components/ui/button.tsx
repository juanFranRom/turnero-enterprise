import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = PropsWithChildren<
	ButtonHTMLAttributes<HTMLButtonElement>
> & {
	variant?: ButtonVariant;
	fullWidth?: boolean;
};

const variantClassName: Record<ButtonVariant, string> = {
	primary:
		'bg-primary text-white hover:bg-primary-hover focus:ring-[rgba(91,93,240,0.18)]',
	secondary:
		'bg-sidebar-active text-primary hover:opacity-90 focus:ring-[rgba(91,93,240,0.18)]',
	ghost:
		'bg-transparent text-primary hover:bg-sidebar-active focus:ring-[rgba(91,93,240,0.18)]',
	danger:
		'bg-danger text-white hover:opacity-90 focus:ring-[rgba(239,68,68,0.18)]',
};

export function Button({
	children,
	className = '',
	variant = 'primary',
	fullWidth = false,
	...props
}: ButtonProps) {
	return (
		<button
			className={[
				'inline-flex h-10 items-center justify-center rounded-button px-[18px] text-small font-medium transition-all duration-fast ease-timora',
				'focus:outline-none focus:ring-2',
				'disabled:cursor-not-allowed disabled:opacity-60',
				fullWidth ? 'w-full' : '',
				variantClassName[variant],
				className,
			]
				.filter(Boolean)
				.join(' ')}
			{...props}
		>
			{children}
		</button>
	);
}