-- Migração manual para produção (SQLite)
-- Observação: ADD COLUMN IF NOT EXISTS pode não existir em versões antigas.
-- Se falhar com "near IF", execute os comandos sem "IF NOT EXISTS".

ALTER TABLE aplicacoes_financeiras
  ADD COLUMN IF NOT EXISTS data_aplicacao DATE;

ALTER TABLE aplicacoes_financeiras
  ADD COLUMN IF NOT EXISTS updated_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_aplicacoes_financeiras_data_aplicacao
  ON aplicacoes_financeiras (data_aplicacao);
