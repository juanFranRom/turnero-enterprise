import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
	label: string;
	error?: string | null;
};

export function Input({ label, error, className = '', ...props }: InputProps) {
	return (
		<label className="flex w-full flex-col gap-2">
			<span className="text-small font-medium text-text-primary">
				{label}
			</span>

			<input
				className={[
					'h-10 rounded-button border bg-card px-3 text-small text-text-primary outline-none transition-all duration-fast ease-timora',
					error
						? 'border-danger focus:border-danger focus:ring-2 focus:ring-[rgba(239,68,68,0.15)]'
						: 'border-border focus:border-primary focus:ring-2 focus:ring-[rgba(91,93,240,0.15)]',
					'placeholder:text-text-secondary',
					className,
				]
					.filter(Boolean)
					.join(' ')}
				{...props}
			/>

			{error ? (
				<span className="text-small text-danger">{error}</span>
			) : null}
		</label>
	);
}