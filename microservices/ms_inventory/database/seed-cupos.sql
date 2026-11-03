-- Ejecutar en la base de Inventory (Neon). Idempotente: repetir para extender la ventana de cupos.
-- Genera horarios y cupos para los proximos 60 dias.
-- 'NODE_ATR_GLORIA' debe coincidir con INVENTORY_SERVICE_ID.
BEGIN;

CREATE TEMP TABLE _atr(atr_id BIGINT, item_id TEXT, cupo INT) ON COMMIT DROP;
INSERT INTO _atr VALUES
 (1,'d8852307-791c-41f0-a3ec-adf4b48cc241',20),
 (2,'1bb26d24-f79d-4833-b9da-a35b8d5ef44d',30),
 (3,'6e97ed14-3094-4e49-a093-452f028bee97',20),
 (4,'6f163ba9-f1c1-4593-8100-92390373688c',40),
 (5,'cc25f94a-7246-41a0-8832-7ca662277107',16),
 (6,'772f0145-fdf7-4f3f-bc97-d402f5607854',18),
 (7,'fb23db38-7474-44d5-86b9-64848371255a',14),
 (8,'eaad2abb-be57-4b0c-ab40-60d5b44f2e44',25),
 (9,'63f24a11-042e-40bb-a23f-55053314260e',20),
 (10,'374b93b8-2315-422a-b913-081448328737',20),
 (11,'44bfda1f-6108-446b-b05c-3e656c2131bd',12);

CREATE TEMP TABLE _hora(hora TIME) ON COMMIT DROP;
INSERT INTO _hora VALUES ('08:00'),('10:00'),('14:00');

INSERT INTO horario(atr_id, hor_hora, hor_cupo)
SELECT a.atr_id, h.hora, a.cupo FROM _atr a CROSS JOIN _hora h
ON CONFLICT (atr_id, hor_hora) DO NOTHING;

INSERT INTO disponibilidad(atr_id, hor_id, dis_fecha, dis_cupo_total)
SELECT a.atr_id, ho.hor_id, d::date, a.cupo
FROM _atr a CROSS JOIN _hora h
JOIN horario ho ON ho.atr_id = a.atr_id AND ho.hor_hora = h.hora
CROSS JOIN generate_series(current_date, current_date + 60, interval '1 day') d
ON CONFLICT (atr_id, dis_fecha, hor_id) DO NOTHING;

INSERT INTO saga_inventory_slot(service_id, item_id, date, slot_id, time_slot, dis_id)
SELECT 'NODE_ATR_GLORIA', a.item_id, di.dis_fecha,
       'slot-' || to_char(di.dis_fecha, 'YYYYMMDD') || '-' || to_char(ho.hor_hora, 'HH24MI'),
       ho.hor_hora, di.dis_id
FROM disponibilidad di
JOIN horario ho ON ho.hor_id = di.hor_id
JOIN _atr a ON a.atr_id = di.atr_id
ON CONFLICT DO NOTHING;

COMMIT;
