import type {
	AppointmentStatus,
	AvailabilityOverrideKind,
	ResourceKind,
} from '../../types/domain';
import type { UserRole } from '../../types/auth';

type TranslateFn = (key: string) => string;

export const getRoleLabel = (
	role: UserRole,
	t: TranslateFn
): string => {
	return t(`roles.${role}`);
};

export const getAppointmentStatusLabel = (
	status: AppointmentStatus,
	t: TranslateFn
): string => {
	return t(`appointmentStatus.${status}`);
};

export const getResourceKindLabel = (
	kind: ResourceKind,
	t: TranslateFn
): string => {
	return t(`resourceKind.${kind}`);
};

export const getAvailabilityOverrideKindLabel = (
	kind: AvailabilityOverrideKind,
	t: TranslateFn
): string => {
	return t(`availabilityOverrideKind.${kind}`);
};