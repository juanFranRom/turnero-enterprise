import './global.css';
import type { Metadata } from 'next';
import { I18nProvider } from '../lib/i18n/provider';

export const metadata: Metadata = {
	title: 'Timora',
	description: 'Smart scheduling for modern businesses',
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>
				<I18nProvider>{children}</I18nProvider>
			</body>
		</html>
	);
}