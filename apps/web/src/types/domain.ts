export type AppointmentStatus =
	| 'BOOKED'
	| 'CONFIRMED'
	| 'CANCELLED'
	| 'NO_SHOW';

export type ResourceKind =
	| 'STAFF'
	| 'ROOM'
	| 'EQUIPMENT';

export type AvailabilityOverrideKind =
	| 'BLOCK'
	| 'EXTRA';