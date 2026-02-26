import { IsISO8601, IsUUID } from 'class-validator';

export class GetAvailabilityDto {
  @IsUUID()
  locationId!: string;

  @IsUUID()
  resourceId!: string;

  @IsUUID()
  serviceId!: string;

  @IsISO8601()
  date!: string;
}