import { DateTime } from 'luxon';
import { AvailabilityEngine } from '../availability/availability.engine';
import { isWithinSlots } from './booking.validator'; // tu isWithinSlots actual
import { assertDurationMatchesService, assertValidTimeRange } from './booking.rules';
import { DomainError } from './appointment.lifecycle';
import type { BookingContext, BookingRequest } from './booking.types';

export class BookingPolicy {
  private readonly engine = new AvailabilityEngine();

  assertBookable(ctx: BookingContext, req: BookingRequest) {
    assertValidTimeRange(req.startsAt, req.endsAt);

    const startUtc = DateTime.fromJSDate(req.startsAt, { zone: 'utc' });
    const endUtc = DateTime.fromJSDate(req.endsAt, { zone: 'utc' });

    assertDurationMatchesService(startUtc, endUtc, ctx.service.durationMinutes);

    const computed = this.engine.compute({
      timezone: ctx.timezone,
      range: ctx.range,
      weekly: ctx.weekly,
      overrides: ctx.overrides,
      busy: ctx.busy,
      service: ctx.service,
      stepMinutes: ctx.stepMinutes,
    });

    const ok = isWithinSlots({
      startsAtUtc: startUtc.toISO()!,
      endsAtUtc: endUtc.toISO()!,
      slots: computed.slots,
    });

    if (!ok) {
      throw new DomainError('OUTSIDE_AVAILABILITY', 'Requested time is outside availability', {
        startsAt: startUtc.toISO(),
        endsAt: endUtc.toISO(),
        timezone: ctx.timezone,
      });
    }
  }
}