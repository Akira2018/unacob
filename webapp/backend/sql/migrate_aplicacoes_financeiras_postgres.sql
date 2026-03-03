-- Migração manual para produção (PostgreSQL)
-- Garante colunas usadas no módulo Aplicações Financeiras

BEGIN;

ALTER TABLE IF EXISTS aplicacoes_financeiras
  ADD COLUMN IF NOT EXISTS data_aplicacao DATE;

ALTER TABLE IF EXISTS aplicacoes_financeiras
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_aplicacoes_financeiras_data_aplicacao
  ON aplicacoes_financeiras (data_aplicacao);

COMMIT;
