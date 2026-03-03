# Checklist rápido de deploy (Hostinger + Ubuntu)

## 1) Atualizar código

```bash
cd /opt/unacob
git fetch origin
git reset --hard origin/main
```

## 2) Rebuild completo (backend + frontend)

```bash
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC down
$DC up -d --build
$DC ps
```

## 3) Confirmar banco e schema

```bash
$DC exec -T backend sh -lc 'python - <<"PY"
from database import SQLALCHEMY_DATABASE_URL
print(SQLALCHEMY_DATABASE_URL)
PY'
```

## 4) Validar API e Conciliação

```bash
curl -sS https://unacobadmin.com.br/api/health
curl -sS -o /dev/null -w "%{http_code}\n" https://unacobadmin.com.br/api/conciliacao
```

Esperado:
- `health` responde com JSON válido.
- `/api/conciliacao` responde (normalmente `401` sem token, ou `200` com token).

## 5) Validação funcional no painel (pós-correção)

No app web (logado):
- Em `Despesas`, confirmar coluna/campo `Fornecedor` e valor correto (sem texto indevido).
- Em mobile, botão/menu lateral abre pelo lado esquerdo e não some.
- Em `Conciliação`, listar mês, abrir sugestões e reconciliar sem erro de rota.

## 6) Acompanhar logs (se necessário)

```bash
$DC logs -f backend
```

## 7) Rollback rápido

Preferencial:

```bash
cd /opt/unacob
./deploy.sh rollback
```

Manual:

```bash
git reset --hard HEAD~1
$DC down
$DC up -d --build
```
