import { CursorPaginationQuery } from 'apps/api/src/common/pagination/dtos/pagination.dto';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListServicesQuery extends CursorPaginationQuery {
  @IsOptional()
  @IsUUID()
  locationId?: string;

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