export type IntervalDto = { startsAt: string; endsAt: string };

export type GetAvailabilityResponse = {
  meta: {
    date: string;
    timezone: string;
    service: {
      id: string;
      durationMinutes: number;
      bufferBeforeMinutes: number;
      bufferAfterMinutes: number;
    };
    stepMinutes: number;
  };
  openIntervals: IntervalDto[];
  busyIntervals: IntervalDto[];
  slots: IntervalDto[];
  counts: {
    openIntervals: number;
    busyIntervals: number;
    slots: number;
  };
};