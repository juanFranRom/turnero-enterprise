'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './button';
import { Card } from './card';
import { cn } from '../../lib/utils/cn';

type ConfirmDialogProps = {
	open: boolean;
	title: string;
	description?: string;
	confirmLabel: string;
	cancelLabel: string;
	onConfirm: () => void | Promise<void>;
	onCancel: () => void;
	confirmVariant?: 'primary' | 'danger';
	loading?: boolean;
	className?: string;
};

export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel,
	cancelLabel,
	onConfirm,
	onCancel,
	confirmVariant = 'primary',
	loading = false,
	className,
}: ConfirmDialogProps) {
	const [mounted, setMounted] = useState(false);

	// Mount guard (Next.js)
	useEffect(() => {
		setMounted(true);
	}, []);

	// Escape key
	useEffect(() => {
		if (!open) {
			return;
		}

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !loading) {
				onCancel();
			}
		};

		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}, [loading, onCancel, open]);

	// Scroll lock
	useEffect(() => {
		if (!open) {
			return;
		}

		const originalOverflow = document.body.style.overflow;

		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, [open]);

	if (!mounted || !open) {
		return null;
	}

	return createPortal(
		<div className="fixed inset-0 z-[1000]">
			<button
				type="button"
				aria-label="Close dialog"
				className="absolute inset-0 h-full w-full bg-[rgba(15,23,42,0.45)] backdrop-blur-[1px]"
				onClick={() => {
					if (!loading) {
						onCancel();
					}
				}}
			/>

			<div className="absolute inset-0 flex items-center justify-center p-4">
				<Card
					className={cn(
						'relative w-full max-w-md space-y-5 shadow-card',
						className
					)}
				>
					<div className="space-y-2">
						<h3 className="text-base font-semibold text-text-primary">
							{title}
						</h3>

						{description ? (
							<p className="text-small text-text-secondary">
								{description}
							</p>
						) : null}
					</div>

					<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="ghost"
							disabled={loading}
							onClick={onCancel}
						>
							{cancelLabel}
						</Button>

						<Button
							type="button"
							variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
							disabled={loading}
							onClick={() => {
								void onConfirm();
							}}
						>
							{confirmLabel}
						</Button>
					</div>
				</Card>
			</div>
		</div>,
		document.body
	);
}