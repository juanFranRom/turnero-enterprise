export type WeeklyRow = { dayOfWeek: number; startTime: Date; endTime: Date };
export type OverrideRow = { kind: 'BLOCK' | 'EXTRA'; startsAt: Date; endsAt: Date };
export type BusyRow = { startsAt: Date; endsAt: Date };

export type ServiceCfg = {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

export type BookingContext = {
  timezone: string;
  range: { from: string; to: string }; // ISO
  weekly: any;    // salida mappers
  overrides: any; // salida mappers
  busy: any;      // salida mappers
  service: ServiceCfg;
  stepMinutes: number;
};

export type BookingRequest = {
  startsAt: Date; // JS Date (UTC)
  endsAt: Date;
};