// apps/api/src/modules/appointments/dtos/appointment-response.dto.ts
import { AppointmentStatus } from '@prisma/client';

export type AppointmentResponseDto = {
  id: string;

  locationId: string;
  resourceId: string;
  serviceId: string | null;

  status: AppointmentStatus;

  startsAt: Date;
  endsAt: Date;

  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;

  cancelledAt: Date | null;
  cancellationReason: string | null;

  rescheduledAt: Date | null;
  rescheduleReason: string | null;

  createdAt: Date;
  updatedAt: Date;
};

export function toAppointmentResponse(appt: {
  id: string;
  locationId: string;
  resourceId: string;
  serviceId: string | null;
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  rescheduledAt: Date | null;
  rescheduleReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AppointmentResponseDto {
  return {
    id: appt.id,
    locationId: appt.locationId,
    resourceId: appt.resourceId,
    serviceId: appt.serviceId,

    status: appt.status,

    startsAt: appt.startsAt,
    endsAt: appt.endsAt,

    customerName: appt.customerName,
    customerPhone: appt.customerPhone,
    customerEmail: appt.customerEmail,
    notes: appt.notes,

    cancelledAt: appt.cancelledAt,
    cancellationReason: appt.cancellationReason,

    rescheduledAt: appt.rescheduledAt,
    rescheduleReason: appt.rescheduleReason,

    createdAt: appt.createdAt,
    updatedAt: appt.updatedAt,
  };
}