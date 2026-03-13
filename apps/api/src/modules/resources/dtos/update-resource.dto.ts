import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsEmail,
	IsOptional,
	IsString,
	Length,
	ValidateNested,
} from 'class-validator';

export class UpdateResourcePersonDto {
	@IsOptional()
	@IsString()
	@Length(1, 80)
	firstName?: string;

	@IsOptional()
	@IsString()
	@Length(1, 80)
	lastName?: string;

	@IsOptional()
	@IsString()
	@Length(4, 32)
	documentNumber?: string;

	@IsOptional()
	@IsEmail()
	@Length(5, 120)
	email?: string;

	@IsOptional()
	@IsString()
	@Length(3, 40)
	phone?: string;

	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}

export class UpdateResourceDto {
	@IsOptional()
	@IsString()
	@Length(2, 80)
	name?: string;

	@IsOptional()
	@IsString()
	@Length(1, 500)
	description?: string;

	@IsOptional()
	@IsBoolean()
	isActive?: boolean;

	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateResourcePersonDto)
	person?: UpdateResourcePersonDto;
}