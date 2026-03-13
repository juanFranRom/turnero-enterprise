'use client';

import { Button } from './button';
import { cn } from '../../lib/utils/cn';

type TablePaginationProps = {
	pageLabel: string;
	previousLabel: string;
	nextLabel: string;
	onPrevious: () => void;
	onNext: () => void;
	canGoPrevious: boolean;
	canGoNext: boolean;
	isLoading?: boolean;
	className?: string;
};

export function TablePagination({
	pageLabel,
	previousLabel,
	nextLabel,
	onPrevious,
	onNext,
	canGoPrevious,
	canGoNext,
	isLoading = false,
	className,
}: TablePaginationProps) {
	return (
		<div
			className={cn(
				'mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between',
				className
			)}
		>
			<div className="text-small text-text-secondary">
				{pageLabel}
			</div>

			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					disabled={!canGoPrevious || isLoading}
					onClick={onPrevious}
				>
					{previousLabel}
				</Button>

				<Button
					variant="ghost"
					disabled={!canGoNext || isLoading}
					onClick={onNext}
				>
					{nextLabel}
				</Button>
			</div>
		</div>
	);
}