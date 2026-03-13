import { Transform } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsOptional,
	IsString,
	IsUUID,
	Length,
} from 'class-validator';
import { ResourceKind } from '@prisma/client';
import { CursorPaginationQuery } from 'apps/api/src/common/pagination/dtos/pagination.dto';

export class ListResourcesQuery extends CursorPaginationQuery {
	@IsOptional()
	@IsUUID()
	locationId?: string;

	@IsOptional()
	@IsEnum(ResourceKind)
	kind?: ResourceKind;

	@IsOptional()
	@IsString()
	@Length(1, 100)
	search?: string;

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