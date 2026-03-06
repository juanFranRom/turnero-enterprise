import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(2, 64)
  timeZone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}