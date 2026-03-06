import { IsEnum, IsOptional, IsUUID, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { ResourceKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import { CursorPaginationQuery } from 'apps/api/src/common/pagination/dtos/pagination.dto';

export class ListResourcesQuery extends CursorPaginationQuery {

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(ResourceKind)
  kind?: ResourceKind;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}