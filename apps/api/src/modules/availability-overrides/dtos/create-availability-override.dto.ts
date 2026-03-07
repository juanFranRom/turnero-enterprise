import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AvailabilityOverrideKind } from '@prisma/client';

export class CreateAvailabilityOverrideDto {
  @IsUUID()
  locationId!: string;

  @IsUUID()
  resourceId!: string;

  @IsEnum(AvailabilityOverrideKind)
  kind!: AvailabilityOverrideKind;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}