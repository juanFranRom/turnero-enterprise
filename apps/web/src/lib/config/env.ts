const getRequiredEnv = (value: string | undefined, name: string): string => {
	if (!value) {
		throw new Error(`Missing required env: ${name}`);
	}

	return value;
};

export const env = {
	apiBaseUrl: getRequiredEnv(
		process.env.NEXT_PUBLIC_API_BASE_URL,
		'NEXT_PUBLIC_API_BASE_URL'
	),
};