import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AvailabilityOverrideKind } from '@prisma/client';
import { CursorPaginationQuery } from '../../../common/pagination/dtos/pagination.dto';

export class ListAvailabilityOverridesQueryDto extends CursorPaginationQuery {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsEnum(AvailabilityOverrideKind)
  kind?: AvailabilityOverrideKind;

  @IsOptional()
  @IsISO8601()
  startsFrom?: string;

  @IsOptional()
  @IsISO8601()
  startsTo?: string;

  @IsOptional()
  @IsISO8601()
  endsFrom?: string;

  @IsOptional()
  @IsISO8601()
  endsTo?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true'
  )
  @IsBoolean()
  upcomingOnly?: boolean;
}