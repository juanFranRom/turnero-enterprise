import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateServiceDto {
  @IsUUID()
  locationId!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferBeforeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferAfterMinutes?: number;

  // isActive lo dejamos para PATCH (como Resource/Location)
}