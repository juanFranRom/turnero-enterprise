export const parseCursorStack = (value: string | null): string[] => {
	if (!value) {
		return [];
	}

	try {
		const parsed = JSON.parse(value);

		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.filter(
			(item): item is string => typeof item === 'string' && item.length > 0
		);
	} catch {
		return [];
	}
};

export const serializeCursorStack = (stack: string[]): string | undefined => {
	if (stack.length === 0) {
		return undefined;
	}

	return JSON.stringify(stack);
};