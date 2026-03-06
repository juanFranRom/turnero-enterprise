import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ResourceKind } from '@prisma/client';

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsEnum(ResourceKind)
  kind?: ResourceKind;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}