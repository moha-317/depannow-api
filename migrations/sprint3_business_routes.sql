-- ============================================================
-- DépanNow — Migration Sprint 3 : Routes Métier
-- ============================================================

-- Ajouter les colonnes manquantes à service_requests
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS request_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS dropoff_address TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_lat DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS dropoff_lng DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS vehicle_details JSONB,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS initial_client_offer DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS accepted_driver_id UUID REFERENCES drivers(id),
  ADD COLUMN IF NOT EXISTS final_price DECIMAL(10, 2);

-- Mettre à jour la contrainte de statut pour inclure 'negotiating'
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;
ALTER TABLE service_requests ADD CONSTRAINT service_requests_status_check
  CHECK (status IN ('pending', 'negotiating', 'offered', 'accepted', 'in_progress', 'completed', 'cancelled'));

-- Ajouter is_counter_offer à offers
ALTER TABLE offers ADD COLUMN IF NOT EXISTS is_counter_offer BOOLEAN DEFAULT false;

-- Supprimer la contrainte UNIQUE sur (service_request_id, driver_id) dans offers
-- pour permettre les contre-offres
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_service_request_id_driver_id_key;

-- Mettre à jour la contrainte de statut des offres pour inclure 'declined'
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_check;
ALTER TABLE offers ADD CONSTRAINT offers_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'rejected', 'cancelled'));
