import type { PropsWithChildren } from 'react';
import { AuthGuard } from '../../components/layout/auth-guard';

export default function OwnerLayout({ children }: PropsWithChildren) {
	return <AuthGuard>{children}</AuthGuard>;
}