export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO (Luxon) 1=Mon ... 7=Sun

export type TimeRange = { start: string; end: string }; // "HH:mm"

export type WeeklySchedule = {
  timezone: string;
  days: Partial<Record<Weekday, TimeRange[]>>;
};

export type AvailabilityOverride =
  | { type: 'CLOSED'; startsAt: string; endsAt: string }
  | { type: 'OPEN'; startsAt: string; endsAt: string; ranges?: TimeRange[] };

export type BusyInterval = { startsAt: string; endsAt: string };

export type ServiceRule = {
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
};

export type AvailabilityInput = {
  timezone: string;
  range: { from: string; to: string };
  weekly: WeeklySchedule;
  overrides: AvailabilityOverride[];
  busy: BusyInterval[];
  service: ServiceRule;
  stepMinutes?: number;
};

export type Slot = { startsAt: string; endsAt: string };

export type AvailabilityResult = { slots: Slot[] };