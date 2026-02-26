import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;
}