import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateWeeklyScheduleDto {
  @IsUUID()
  locationId!: string;

  @IsUUID()
  resourceId!: string;

  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number; // 1=Monday ... 7=Sunday (como tu seed)

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string; // HH:mm

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime!: string; // HH:mm

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  effectiveTo?: string | null;
}