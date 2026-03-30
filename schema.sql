-- ============================================================
-- DépanNow — Schéma PostgreSQL complet
-- Version : Sprint 1
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- TABLE : users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  phone         VARCHAR(20) NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'driver', 'admin')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ─────────────────────────────────────────────────────────────
-- TABLE : drivers
-- Profil étendu des dépanneurs (lié à users)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name    VARCHAR(150),
  license_number  VARCHAR(50) NOT NULL,
  vehicle_type    VARCHAR(50),
  latitude        DECIMAL(10, 8),
  longitude       DECIMAL(11, 8),
  is_available    BOOLEAN NOT NULL DEFAULT false,
  rating          DECIMAL(3, 2) DEFAULT 0.00,
  total_reviews   INTEGER DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_available ON drivers(is_available);
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers(latitude, longitude);

-- ─────────────────────────────────────────────────────────────
-- TABLE : service_requests
-- Demandes de dépannage émises par les clients
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  latitude        DECIMAL(10, 8) NOT NULL,
  longitude       DECIMAL(11, 8) NOT NULL,
  address         TEXT,
  vehicle_brand   VARCHAR(100),
  vehicle_model   VARCHAR(100),
  vehicle_year    SMALLINT,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'offered', 'accepted', 'in_progress', 'completed', 'cancelled')),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_client ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);

-- ─────────────────────────────────────────────────────────────
-- TABLE : offers
-- Offres des dépanneurs sur les demandes de service
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_request_id  UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  driver_id           UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  price               DECIMAL(10, 2) NOT NULL,
  eta_minutes         INTEGER,
  message             TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (service_request_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_offers_request ON offers(service_request_id);
CREATE INDEX IF NOT EXISTS idx_offers_driver ON offers(driver_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

-- ─────────────────────────────────────────────────────────────
-- TABLE : payments
-- Paiements avec répartition commission/chauffeur
-- Commission DépanNow : 7%  |  Reversement chauffeur : 93%
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_request_id  UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  offer_id            UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES users(id),
  driver_id           UUID NOT NULL REFERENCES drivers(id),
  amount              DECIMAL(10, 2) NOT NULL,           -- Montant total payé par le client
  commission_rate     DECIMAL(5, 4) NOT NULL DEFAULT 0.0700,  -- 7%
  commission_amount   DECIMAL(10, 2) NOT NULL,           -- amount * 0.07
  driver_payout       DECIMAL(10, 2) NOT NULL,           -- amount * 0.93
  currency            VARCHAR(3) NOT NULL DEFAULT 'EUR',
  payment_method      VARCHAR(30) DEFAULT 'card',
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_id   VARCHAR(255),
  paid_at             TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_driver ON payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_request ON payments(service_request_id);

-- ─────────────────────────────────────────────────────────────
-- TABLE : reviews
-- Avis laissés par les clients après intervention
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_request_id  UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES users(id),
  driver_id           UUID NOT NULL REFERENCES drivers(id),
  rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment             TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (service_request_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_driver ON reviews(driver_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client ON reviews(client_id);

-- ─────────────────────────────────────────────────────────────
-- TABLE : notifications
-- Système de notifications in-app
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  type        VARCHAR(50) NOT NULL DEFAULT 'info'
                CHECK (type IN ('info', 'offer', 'payment', 'status_update', 'review', 'system')),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ─────────────────────────────────────────────────────────────
-- TRIGGER : auto-update updated_at
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['users', 'drivers', 'service_requests', 'offers', 'payments']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I;
       CREATE TRIGGER set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl
    );
  END LOOP;
END;
$$;
