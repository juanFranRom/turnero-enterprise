const ACCESS_TOKEN_KEY = 'turnero.accessToken';
const ACTIVE_TENANT_SLUG_KEY = 'turnero.activeTenantSlug';

const isBrowser = (): boolean => typeof window !== 'undefined';

export const sessionStore = {
	getAccessToken(): string | null {
		if (!isBrowser()) {
			return null;
		}

		return window.localStorage.getItem(ACCESS_TOKEN_KEY);
	},

	setAccessToken(token: string) {
		if (!isBrowser()) {
			return;
		}

		window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
	},

	getActiveTenantSlug(): string | null {
		if (!isBrowser()) {
			return null;
		}

		return window.localStorage.getItem(ACTIVE_TENANT_SLUG_KEY);
	},

	setActiveTenantSlug(tenantSlug: string) {
		if (!isBrowser()) {
			return;
		}

		window.localStorage.setItem(ACTIVE_TENANT_SLUG_KEY, tenantSlug);
	},

	clear() {
		if (!isBrowser()) {
			return;
		}

		window.localStorage.removeItem(ACCESS_TOKEN_KEY);
		window.localStorage.removeItem(ACTIVE_TENANT_SLUG_KEY);
	},
};