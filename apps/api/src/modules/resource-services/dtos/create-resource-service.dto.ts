import { IsUUID } from 'class-validator';

export class CreateResourceServiceDto {
  @IsUUID()
  resourceId!: string;

  @IsUUID()
  serviceId!: string;
}