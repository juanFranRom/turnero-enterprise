import {
	IsBoolean,
	IsOptional,
	IsString,
	Length,
} from 'class-validator';

export class UpdateLocationDto {
	@IsOptional()
	@IsString()
	@Length(2, 80)
	name?: string;

	@IsOptional()
	@IsString()
	@Length(2, 64)
	timeZone?: string;

	@IsOptional()
	@IsBoolean()
	isActive?: boolean;

	@IsOptional()
	@IsString()
	@Length(3, 40)
	phone?: string;

	@IsOptional()
	@IsString()
	@Length(3, 120)
	addressLine1?: string;

	@IsOptional()
	@IsString()
	@Length(1, 120)
	addressLine2?: string;

	@IsOptional()
	@IsString()
	@Length(2, 80)
	city?: string;

	@IsOptional()
	@IsString()
	@Length(2, 80)
	state?: string;

	@IsOptional()
	@IsString()
	@Length(2, 20)
	postalCode?: string;
}