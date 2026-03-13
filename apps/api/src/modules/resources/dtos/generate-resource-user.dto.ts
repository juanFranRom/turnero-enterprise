
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Role } from '@prisma/client';

export class GenerateResourceUserDto {
	@IsOptional()
	@IsEnum(Role)
	role?: Role;

	@IsOptional()
	@IsString()
	@Length(8, 128)
	temporaryPassword?: string;
}