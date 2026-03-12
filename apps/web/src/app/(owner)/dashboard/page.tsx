'use client';

import { useT } from '../../../lib/i18n/use-t';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';

export default function DashboardPage() {
	const t = useT();

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<div className="text-caption uppercase tracking-[0.18em] text-text-secondary">
						{t('dashboard.overview')}
					</div>
					<h1 className="mt-2 text-h2 text-text-primary">
						{t('dashboard.title')}
					</h1>
					<p className="mt-2 text-small text-text-secondary">
						{t('dashboard.subtitle')}
					</p>
				</div>

				<Button>{t('dashboard.newAppointment')}</Button>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<Card className="p-5">
					<div className="text-small text-text-secondary">
						{t('dashboard.metrics.locations')}
					</div>
					<div className="mt-2 text-h2 text-text-primary">--</div>
				</Card>

				<Card className="p-5">
					<div className="text-small text-text-secondary">
						{t('dashboard.metrics.resources')}
					</div>
					<div className="mt-2 text-h2 text-text-primary">--</div>
				</Card>

				<Card className="p-5">
					<div className="text-small text-text-secondary">
						{t('dashboard.metrics.services')}
					</div>
					<div className="mt-2 text-h2 text-text-primary">--</div>
				</Card>

				<Card className="p-5">
					<div className="text-small text-text-secondary">
						{t('dashboard.metrics.appointments')}
					</div>
					<div className="mt-2 text-h2 text-text-primary">--</div>
				</Card>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
				<Card className="min-h-[420px]">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-h3 text-text-primary">
								{t('dashboard.calendarPreview.title')}
							</h2>
							<p className="mt-1 text-small text-text-secondary">
								{t('dashboard.calendarPreview.subtitle')}
							</p>
						</div>

						<Badge variant="info">
							{t('dashboard.calendarPreview.dayView')}
						</Badge>
					</div>

					<div className="mt-6 grid h-[300px] grid-cols-4 gap-3">
						<div className="rounded-lg border border-border bg-bg p-3 text-small text-text-secondary">
							09:00
						</div>
						<div className="rounded-lg border border-border bg-[rgba(34,197,94,0.10)] p-3">
							<div className="text-small font-semibold text-text-primary">
								Carla Rodriguez
							</div>
							<div className="mt-1 text-caption text-success">
								Dental Cleaning
							</div>
						</div>
						<div className="rounded-lg border border-border bg-[rgba(34,193,241,0.10)] p-3">
							<div className="text-small font-semibold text-text-primary">
								Martin García
							</div>
							<div className="mt-1 text-caption text-secondary">
								Physical Therapy
							</div>
						</div>
						<div className="rounded-lg border border-border bg-[rgba(91,93,240,0.10)] p-3">
							<div className="text-small font-semibold text-text-primary">
								Ana López
							</div>
							<div className="mt-1 text-caption text-primary">
								Confirmed
							</div>
						</div>
					</div>
				</Card>

				<div className="space-y-6">
					<Card>
						<div className="flex items-center justify-between">
							<h2 className="text-h3 text-text-primary">
								{t('dashboard.todayAppointments.title')}
							</h2>
							<span className="text-small font-semibold text-text-secondary">
								16
							</span>
						</div>

						<div className="mt-4 space-y-3">
							<div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
								<span className="text-small text-text-secondary">
									{t('dashboard.todayAppointments.today')}
								</span>
								<Badge variant="success">12</Badge>
							</div>
							<div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
								<span className="text-small text-text-secondary">
									{t('dashboard.todayAppointments.pending')}
								</span>
								<Badge variant="warning">1</Badge>
							</div>
							<div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
								<span className="text-small text-text-secondary">
									{t('dashboard.todayAppointments.cancelled')}
								</span>
								<Badge variant="danger">3</Badge>
							</div>
						</div>
					</Card>

					<Card>
						<h2 className="text-h3 text-text-primary">
							{t('dashboard.quickActions.title')}
						</h2>

						<div className="mt-4 flex flex-col gap-3">
							<Button fullWidth>
								{t('dashboard.quickActions.newAppointment')}
							</Button>
							<Button fullWidth variant="secondary">
								{t('dashboard.quickActions.newClient')}
							</Button>
							<Button fullWidth variant="ghost">
								{t('dashboard.quickActions.newService')}
							</Button>
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}