CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "AvailabilityOverride"
  ADD CONSTRAINT "chk_availability_override_time_range"
  CHECK ("endsAt" > "startsAt");

ALTER TABLE "AvailabilityOverride"
  ADD CONSTRAINT "availability_override_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "resourceId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  );