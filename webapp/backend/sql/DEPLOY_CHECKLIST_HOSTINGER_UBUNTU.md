# Checklist rápido de deploy (Hostinger + Ubuntu)

## 1) Atualizar código

```bash
cd /opt/unacob
git pull origin main
```

## 2) Rebuild e restart do backend

```bash
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d --build backend
$DC restart backend
```

## 3) Confirmar banco e schema

```bash
$DC exec -T backend sh -lc 'python - <<"PY"
from database import SQLALCHEMY_DATABASE_URL
print(SQLALCHEMY_DATABASE_URL)
PY'
```

## 4) Validar health e diagnóstico de schema

```bash
curl -sS https://unacobadmin.com.br/api/health
```

No painel (logado como administrador), valide:
- `GET /api/admin/system/schema`
- Campo `status` deve retornar `ok`.
- `tables.aplicacoes_financeiras.missing_columns` deve vir vazio.

## 5) Acompanhar logs em tempo real (se necessário)

```bash
$DC logs -f backend
```

## 6) Rollback rápido (se algo quebrar)

```bash
git reset --hard HEAD~1
$DC up -d --build backend
```
