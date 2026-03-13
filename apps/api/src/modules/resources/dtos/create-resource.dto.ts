import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsEmail,
	IsEnum,
	IsNotEmptyObject,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import { ResourceKind, Role } from '@prisma/client';

export class CreateResourcePersonDto {
	@IsString()
	@Length(1, 80)
	firstName!: string;

	@IsString()
	@Length(1, 80)
	lastName!: string;

	@IsString()
	@Length(4, 32)
	documentNumber!: string;

	@IsEmail()
	@Length(5, 120)
	email!: string;

	@IsOptional()
	@IsString()
	@Length(3, 40)
	phone?: string;
}

export class CreateResourceUserDto {
	@IsOptional()
	@IsBoolean()
	create?: boolean;

	@ValidateIf((dto: CreateResourceUserDto) => dto.create === true)
	@IsOptional()
	@IsEnum(Role)
	role?: Role;

	@ValidateIf((dto: CreateResourceUserDto) => dto.create === true)
	@IsOptional()
	@IsString()
	@Length(8, 128)
	temporaryPassword?: string;
}

export class CreateResourceDto {
	@IsUUID()
	locationId!: string;

	@IsString()
	@Length(2, 80)
	name!: string;

	@IsOptional()
	@IsString()
	@Length(1, 500)
	description?: string;

	@IsEnum(ResourceKind)
	kind!: ResourceKind;

	@ValidateIf((dto: CreateResourceDto) => dto.kind === ResourceKind.PERSON)
	@IsOptional()
	@ValidateNested()
	@Type(() => CreateResourcePersonDto)
	person?: CreateResourcePersonDto;

	@ValidateIf((dto: CreateResourceDto) => dto.kind === ResourceKind.PERSON)
	@IsOptional()
	@ValidateNested()
	@Type(() => CreateResourceUserDto)
	user?: CreateResourceUserDto;
}