-- 1) Necesario para usar "=" con uuid/text dentro de GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2) Sanidad básica
ALTER TABLE "Appointment"
  ADD CONSTRAINT "chk_appointment_time_range"
  CHECK ("endsAt" > "startsAt");

 -- 3) Anti-overlap real (sin columna slot, sin triggers)
--    Como startsAt/endsAt son timestamp WITHOUT time zone => usamos tsrange 
ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "resourceId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" IN ('BOOKED','CONFIRMED'));