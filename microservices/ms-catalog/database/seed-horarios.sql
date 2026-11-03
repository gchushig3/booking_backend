-- Ejecutar en la base de Catalog (Neon). Alinea schedule_times de los perfiles Booking
-- con los horarios sembrados en Inventory (seed-cupos.sql).
UPDATE booking_attraction_profile
SET payload = jsonb_set(payload, '{schedule_times}', '["08:00","10:00","14:00"]'::jsonb),
    updated_at = now();
