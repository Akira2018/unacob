# Migração manual - Aplicações Financeiras

## 1) Verificar se faltam colunas

### PostgreSQL
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'aplicacoes_financeiras'
ORDER BY column_name;
```

### SQLite
```sql
PRAGMA table_info(aplicacoes_financeiras);
```

## 2) Aplicar script

- PostgreSQL: execute `migrate_aplicacoes_financeiras_postgres.sql`
- SQLite: execute `migrate_aplicacoes_financeiras_sqlite.sql`

## 3) Validar endpoint

Após aplicar, testar autenticado:
- `GET /api/aplicacoes-financeiras?mes_referencia=2026-03`
- `GET /api/aplicacoes-financeiras/resumo?mes_referencia=2026-03`

Se retornar 200, o frontend deve parar de exibir o toast "Erro ao carregar aplicações financeiras".
