'use client';

import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
} from 'react';
import { cn } from '../../lib/utils/cn';
import { useT } from '../../lib/i18n/use-t';

export type SelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};

type SelectProps = {
	label?: string;
	value?: string;
	onValueChange?: (value: string) => void;
	options: SelectOption[];
	placeholder?: string;
	error?: string;
	hint?: string;
	disabled?: boolean;
	className?: string;
	triggerClassName?: string;
	dropdownClassName?: string;
	name?: string;
};

const getEnabledOptions = (options: SelectOption[]) => {
	return options.filter((option) => !option.disabled);
};

export function Select({
	label,
	value,
	onValueChange,
	options,
	placeholder,
	error,
	hint,
	disabled = false,
	className,
	triggerClassName,
	dropdownClassName,
	name,
}: SelectProps) {
	const t = useT();
	const rootRef = useRef<HTMLDivElement | null>(null);
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const [open, setOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

	const selectedOption = useMemo(() => {
		return options.find((option) => option.value === value) ?? null;
	}, [options, value]);

	const resolvedPlaceholder =
		placeholder ?? t('common.selectPlaceholder');

	const enabledOptions = useMemo(() => {
		return getEnabledOptions(options);
	}, [options]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			if (!rootRef.current) {
				return;
			}

			if (!rootRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
				buttonRef.current?.focus();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscape as unknown as EventListener);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener(
				'keydown',
				handleEscape as unknown as EventListener
			);
		};
	}, [open]);

	useEffect(() => {
		if (!open) {
			setHighlightedIndex(-1);
			return;
		}

		const selectedEnabledIndex = enabledOptions.findIndex(
			(option) => option.value === value
		);

		if (selectedEnabledIndex >= 0) {
			setHighlightedIndex(selectedEnabledIndex);
			return;
		}

		setHighlightedIndex(enabledOptions.length > 0 ? 0 : -1);
	}, [enabledOptions, open, value]);

	const commitValue = (nextValue: string) => {
		if (disabled) {
			return;
		}

		onValueChange?.(nextValue);
		setOpen(false);
		buttonRef.current?.focus();
	};

	const moveHighlight = (direction: 'next' | 'prev') => {
		if (enabledOptions.length === 0) {
			return;
		}

		setHighlightedIndex((current) => {
			if (current < 0) {
				return 0;
			}

			if (direction === 'next') {
				return current >= enabledOptions.length - 1 ? 0 : current + 1;
			}

			return current <= 0 ? enabledOptions.length - 1 : current - 1;
		});
	};

	const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (disabled) {
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
			case 'Enter':
			case ' ':
				event.preventDefault();
				setOpen(true);
				break;
			case 'ArrowUp':
				event.preventDefault();
				setOpen(true);
				break;
			default:
				break;
		}
	};

	const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				moveHighlight('next');
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveHighlight('prev');
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();

				if (highlightedIndex >= 0 && enabledOptions[highlightedIndex]) {
					commitValue(enabledOptions[highlightedIndex].value);
				}
				break;
			case 'Escape':
				event.preventDefault();
				setOpen(false);
				buttonRef.current?.focus();
				break;
			case 'Tab':
				setOpen(false);
				break;
			default:
				break;
		}
	};

	return (
		<div className={cn('flex flex-col gap-2', className)} ref={rootRef}>
			{label ? (
				<label className="text-small font-medium text-text-primary">
					{label}
				</label>
			) : null}

			<div className="relative">
				{name ? <input type="hidden" name={name} value={value ?? ''} /> : null}

				<button
					ref={buttonRef}
					type="button"
					disabled={disabled}
					aria-haspopup="listbox"
					aria-expanded={open}
					onClick={() => setOpen((current) => !current)}
					onKeyDown={handleTriggerKeyDown}
					className={cn(
						'flex h-10 w-full items-center justify-between rounded-button border border-border bg-card px-3 text-left text-small outline-none transition-all duration-fast ease-timora',
						'focus:border-primary focus:ring-2 focus:ring-[rgba(91,93,240,0.15)]',
						disabled ? 'cursor-not-allowed opacity-60' : '',
						error ? 'border-danger focus:ring-[rgba(239,68,68,0.12)]' : '',
						selectedOption ? 'text-text-primary' : 'text-text-secondary',
						triggerClassName
					)}
				>
					<span className="truncate">
						{selectedOption?.label ?? resolvedPlaceholder}
					</span>

					<span
						className={cn(
							'ml-3 shrink-0 text-text-secondary transition-transform duration-fast',
							open ? 'rotate-180' : ''
						)}
						aria-hidden="true"
					>
						▼
					</span>
				</button>

				{open ? (
					<div
						role="listbox"
						tabIndex={-1}
						onKeyDown={handleListKeyDown}
						className={cn(
							'absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-card border border-border bg-card p-1 shadow-card',
							dropdownClassName
						)}
					>
						{options.length === 0 ? (
							<div className="px-3 py-2 text-small text-text-secondary">
								{t('common.noOptions')}
							</div>
						) : (
							options.map((option) => {
								const enabledIndex = enabledOptions.findIndex(
									(enabledOption) => enabledOption.value === option.value
								);

								const isHighlighted =
									!option.disabled &&
									enabledIndex >= 0 &&
									enabledIndex === highlightedIndex;

								const isSelected = option.value === value;

								return (
									<button
										key={option.value}
										type="button"
										role="option"
										aria-selected={isSelected}
										disabled={option.disabled}
										onMouseEnter={() => {
											if (option.disabled || enabledIndex < 0) {
												return;
											}

											setHighlightedIndex(enabledIndex);
										}}
										onClick={() => {
											if (option.disabled) {
												return;
											}

											commitValue(option.value);
										}}
                                        className={cn(
                                            'flex h-10 w-full items-center justify-between rounded-button px-3 text-left text-small transition-colors duration-fast ease-timora',
                                            option.disabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-[rgba(91,93,240,0.08)]',
                                            isSelected
                                                ? 'bg-[rgba(91,93,240,0.12)] text-primary'
                                                : isHighlighted
                                                    ? 'bg-[rgba(91,93,240,0.08)] text-text-primary'
                                                    : 'text-text-primary'
                                        )}
									>
										<span className="truncate">{option.label}</span>
										{isSelected ? (
											<span className="ml-3 shrink-0 text-primary">✓</span>
										) : null}
									</button>
								);
							})
						)}
					</div>
				) : null}
			</div>

			{error ? (
				<span className="text-small text-danger">{error}</span>
			) : hint ? (
				<span className="text-small text-text-secondary">{hint}</span>
			) : null}
		</div>
	);
}