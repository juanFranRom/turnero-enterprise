import type { WeeklyRow, OverrideRow, BusyRow, ServiceCfg } from './booking.types';

export interface AvailabilityReadPort {
  getLocationTZ(args: { tenantId: string; locationId: string }): Promise<string>;
  getServiceCfg(args: { tenantId: string; locationId: string; serviceId: string }): Promise<ServiceCfg>;
  assertResourceServiceAllowed(args: { tenantId: string; resourceId: string; serviceId: string }): Promise<void>;

  getWeekly(args: {
    tenantId: string; 
    locationId: string; 
    resourceId: string;
    dayOfWeek: number; 
    from: Date; 
    to: Date;
  }): Promise<WeeklyRow[]>;

  getOverrides(args: {
    tenantId: string; 
    locationId: string; 
    resourceId: string;
    from: Date; 
    to: Date;
  }): Promise<OverrideRow[]>;

  getBusy(args: {
    tenantId: string; 
    locationId: string; 
    resourceId: string;
    from: Date; 
    to: Date;
    excludeAppointmentId?: string;
  }): Promise<BusyRow[]>;
}