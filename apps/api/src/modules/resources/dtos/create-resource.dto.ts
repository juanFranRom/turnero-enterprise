import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ResourceKind } from '@prisma/client';

export class CreateResourceDto {
  @IsUUID()
  locationId!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsEnum(ResourceKind)
  kind?: ResourceKind;
}