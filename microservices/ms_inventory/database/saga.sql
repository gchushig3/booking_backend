-- Aplicar despues del SQL oficial de ms_inventory y saga-runtime.sql.
CREATE TABLE IF NOT EXISTS saga_inventory_slot (
  service_id TEXT NOT NULL, item_id TEXT NOT NULL, date DATE NOT NULL, slot_id TEXT NOT NULL, time_slot TIME NOT NULL,
  dis_id BIGINT NOT NULL UNIQUE REFERENCES disponibilidad(dis_id), source_timestamp BIGINT NOT NULL DEFAULT 0,
  zero_capacity BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY(service_id,item_id,date,slot_id)
);
CREATE TABLE IF NOT EXISTS saga_inventory_hold (
  reservation_id UUID PRIMARY KEY, payload JSONB NOT NULL, allocations JSONB NOT NULL DEFAULT '[]',
  state TEXT NOT NULL CHECK(state IN ('HELD','CONFIRMED','RELEASED','REJECTED')),
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_inventory_hold_expiration ON saga_inventory_hold(expires_at) WHERE state='HELD';
