-- Despues del SQL oficial de ms_cart y shared-infrastructure/sql/saga-runtime.sql.
CREATE TABLE IF NOT EXISTS saga_cart_line (
  cai_id BIGINT PRIMARY KEY REFERENCES carrito_item(cai_id) ON DELETE CASCADE,
  car_id BIGINT NOT NULL REFERENCES carrito(car_id), item_id TEXT NOT NULL, date DATE NOT NULL,
  slot_id TEXT NOT NULL, payload JSONB NOT NULL, UNIQUE(car_id,item_id,date,slot_id)
);
CREATE TABLE IF NOT EXISTS saga_cart_reservation (
  reservation_id UUID PRIMARY KEY, car_id BIGINT NOT NULL UNIQUE REFERENCES carrito(car_id), user_id BIGINT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','CONFIRMED','CANCELLED')),
  paid BOOLEAN NOT NULL DEFAULT false, stock_confirmed BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_saga_cart_owner ON saga_cart_reservation(user_id);
