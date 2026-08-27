-- =============================================================================
-- reset_recebimento_mensalidades.sql
-- =============================================================================
-- Esvazia SOMENTE o dominio "recebimento de mensalidades" para reinicio dos
-- dados reais a partir de janeiro/2026.
--
-- APAGA:
--   * pagamentos                         (todos - 100% sao mensalidade de membro)
--   * transacoes  origem in ('mensalidade','BB-PDF')   (lancamentos no razao)
--   * conciliacoes  tipo = 'credito'     (conciliacao de credito = mensalidade)
--   * dabb_remessas / dabb_remessa_itens (artefatos de cobranca de mensalidade)
--
-- MANTEM (nao referenciado aqui):
--   membros, despesas, outras_rendas, plano_contas, saldos_mensais, festas,
--   participacao_festa, users, previsoes_orcamentarias*, aplicacoes_financeiras,
--   configuracoes_sistema (exceto o contador dabb_ultimo_sequencial, resetado p/ 0),
--   conciliacoes tipo = 'debito' (conciliacao de despesa).
--
-- Ordem respeita as FKs:
--   dabb_remessa_itens -> (conciliacoes, dabb_remessas, membros)
--   conciliacoes.pagamento_id -> pagamentos
-- =============================================================================

PRAGMA foreign_keys = ON;

BEGIN;

-- 1) Itens de remessa DABB (referenciam conciliacoes e dabb_remessas)
DELETE FROM dabb_remessa_itens;

-- 2) Remessas DABB
DELETE FROM dabb_remessas;

-- 3) Conciliacoes de credito (recebimento de mensalidade, casadas ou nao)
DELETE FROM conciliacoes
WHERE tipo = 'credito';

-- 4) Lancamentos de razao originados de recebimento de mensalidade
DELETE FROM transacoes
WHERE origem IN ('mensalidade', 'BB-PDF');

-- 5) Pagamentos de mensalidade
DELETE FROM pagamentos;

-- 6) Reinicia o sequencial de arquivo DABB
UPDATE configuracoes_sistema
SET valor = '0', updated_at = CURRENT_TIMESTAMP
WHERE chave = 'dabb_ultimo_sequencial';

COMMIT;

-- Recupera espaco em disco do arquivo SQLite (fora de transacao)
VACUUM;

-- -----------------------------------------------------------------------------
-- Verificacao (todos os counts devem ser 0, exceto o contador = 0):
--   SELECT 'pagamentos', COUNT(*) FROM pagamentos
--   UNION ALL SELECT 'transacoes_mens', COUNT(*) FROM transacoes WHERE origem IN ('mensalidade','BB-PDF')
--   UNION ALL SELECT 'conciliacoes_credito', COUNT(*) FROM conciliacoes WHERE tipo='credito'
--   UNION ALL SELECT 'dabb_remessas', COUNT(*) FROM dabb_remessas
--   UNION ALL SELECT 'dabb_remessa_itens', COUNT(*) FROM dabb_remessa_itens
--   UNION ALL SELECT 'seq_dabb', valor FROM configuracoes_sistema WHERE chave='dabb_ultimo_sequencial'
--   UNION ALL SELECT 'despesas (mantido)', COUNT(*) FROM despesas
--   UNION ALL SELECT 'conciliacoes_debito (mantido)', COUNT(*) FROM conciliacoes WHERE tipo='debito'
--   UNION ALL SELECT 'membros (mantido)', COUNT(*) FROM membros;
-- -----------------------------------------------------------------------------
