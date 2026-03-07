export function mapAvailabilityOverride(entity: any) {
  return {
    id: entity.id,
    locationId: entity.locationId,
    resourceId: entity.resourceId,
    kind: entity.kind,
    startsAt: entity.startsAt,
    endsAt: entity.endsAt,
    reason: entity.reason,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}