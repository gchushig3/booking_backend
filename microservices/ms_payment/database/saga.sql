-- Ledger de simulaciones Saga. No inventa ord_id ni modifica el contrato de pago/Order.
CREATE TABLE IF NOT EXISTS saga_payment (
  reservation_id UUID PRIMARY KEY, payload JSONB NOT NULL,
  created_seen BOOLEAN NOT NULL DEFAULT false, stock_held BOOLEAN NOT NULL DEFAULT false,
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','APPROVED','FAILED','REFUNDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);
