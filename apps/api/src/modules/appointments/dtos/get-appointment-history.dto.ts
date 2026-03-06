import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AppointmentHistoryAction, AuditActorType } from '@prisma/client';

export class GetAppointmentHistoryQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string; // base64url(json)
}

export type AppointmentHistoryItemDto = {
  id: string;
  at: string; // ISO
  action: AppointmentHistoryAction;

  actor: {
    type: AuditActorType;
    userId?: string | null;
  };

  resourceId: string;
  serviceId?: string | null;
  locationId: string;

  prev: { startsAt: string | null; endsAt: string | null };
  next: { startsAt: string | null; endsAt: string | null };

  reason: string | null;
  idempotencyKey: string | null;
  metadata: unknown | null;
};

export type GetAppointmentHistoryResponseDto = {
  items: AppointmentHistoryItemDto[];
  nextCursor?: string;
};