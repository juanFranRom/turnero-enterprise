export type OwnerCrudEntity =
  | 'location'
  | 'resource'
  | 'service'
  | 'weekly_schedule'
  | 'resource_service'
  | 'availability_override';

export type OwnerCrudAction =
  | 'create'
  | 'list'
  | 'get'
  | 'update'
  | 'delete';

export type OwnerCrudStatus = 'success' | 'error';

export type OwnerCrudMetricBase = {
  entity: OwnerCrudEntity;
  action: OwnerCrudAction;
  tenant: string;
};

export type OwnerCrudErrorMetric = OwnerCrudMetricBase & {
  code: string;
};

export type OwnerCrudTrackArgs<T> = OwnerCrudMetricBase & {
  run: () => Promise<T>;
};