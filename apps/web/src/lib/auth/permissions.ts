import type { UserRole } from '../../types/auth';

export const canMutate = (role: UserRole | null | undefined): boolean => {
	return role === 'OWNER' || role === 'ADMIN';
};

export const canViewOwnerModules = (
	role: UserRole | null | undefined
): boolean => {
	return role === 'OWNER' || role === 'ADMIN' || role === 'STAFF';
};