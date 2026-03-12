export type ApiErrorPayload = {
	code: string;
	message: string;
	details?: unknown;
};

export type ApiListResponse<T> = {
	items: T[];
	nextCursor: string | null;
};

export type ApiMutationSuccess = {
	success: true;
};