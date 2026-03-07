import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { AppointmentHistoryAction } from '@prisma/client';

export class GetAppointmentsHistoryGlobalQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direction?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  action?: AppointmentHistoryAction;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export type AppointmentsHistoryGlobalItemDto = {
  id: string;
  at: string;
  action: AppointmentHistoryAction;
  actorType: 'USER' | 'SYSTEM';
  actorUserId: string | null;

  appointmentId: string;
  resourceId: string;
  serviceId: string | null;
  locationId: string;

  reason: string | null;
  metadata: unknown | null;
};

export type GetAppointmentsHistoryGlobalResponseDto = {
  items: AppointmentsHistoryGlobalItemDto[];
  nextCursor?: string | null;
};