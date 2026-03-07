import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AvailabilityOverrideKind } from '@prisma/client';

export class UpdateAvailabilityOverrideDto {
  @IsOptional()
  @IsEnum(AvailabilityOverrideKind)
  kind?: AvailabilityOverrideKind;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}