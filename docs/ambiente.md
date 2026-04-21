# Guia de Ambiente

## Objetivo

Este documento centraliza as variáveis de ambiente e as diferenças de configuração entre execução local, Docker e hospedagem.

## Backend

O backend carrega variáveis a partir de `webapp/backend/.env`.

Arquivo de referência no repositório: [webapp/backend/.env.example](webapp/backend/.env.example).

### Exemplo de arquivo

```env
DATABASE_URL=sqlite:///./associacao.db
SECRET_KEY=troque-esta-chave-em-producao
ACCESS_TOKEN_EXPIRE_MINUTES=480

SQLITE_BUSY_TIMEOUT_MS=15000
SQLITE_JOURNAL_MODE=WAL
SQLITE_SYNCHRONOUS=NORMAL

BACKUP_RETENTION_COUNT=30
AUTO_BACKUP_ON_STARTUP=true
SCHEDULED_BACKUP_ENABLED=true
SCHEDULED_BACKUP_HOUR=20
SCHEDULED_BACKUP_INTERVAL_SECONDS=900
BACKUP_TIMEZONE=America/Sao_Paulo

DABB_TAXA_BIMESTRAL=1.00
DABB_VALOR_MENSAL_PADRAO=35.00
DABB_EMPRESA=UNIAO DOS APOSENTADO
DABB_CONVENIO=112339
DABB_ARQUIVO_PREFIXO=DBT
DABB_LAYOUT=10006
DABB_ARQUIVO_CONVENIO_NOME=12339

FRONTEND_URL=http://localhost:5173

SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_USER=usuario@example.com
SMTP_PASSWORD=senha-smtp
SMTP_FROM_NAME=UNACOB
SMTP_FROM_EMAIL=usuario@example.com
SMTP_STARTTLS=true

EMAIL_LOGO_URL=https://exemplo.com/logo.png
EMAIL_FESTA_IMAGE_URL=https://exemplo.com/festa.png
```

### Variáveis obrigatórias em produção

- `DATABASE_URL`
- `SECRET_KEY`
- `FRONTEND_URL` ou `FRONTEND_BASE_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` se houver envio de e-mail

### Observações

- Em desenvolvimento local, o padrão é SQLite.
- Em produção, o projeto aceita PostgreSQL via `DATABASE_URL`.
- `SECRET_KEY` nunca deve permanecer com valor padrão.
- As rotinas de backup dependem das variáveis de agendamento e retenção.

## Frontend

O frontend usa variáveis de build do Vite.

Arquivo de referência no repositório: [webapp/frontend/.env.example](webapp/frontend/.env.example).

### Exemplo de arquivo

Arquivo sugerido: `webapp/frontend/.env.local`

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_BASE_PATH=/
```

### Observações

- Se `VITE_API_BASE_URL` estiver ausente, inválida ou apontando para host bloqueado, o frontend cai para `/api`.
- Em deploy com reverse proxy ou Docker Compose, usar `/api` costuma ser o caminho mais simples.

## Execução local

### Backend

```bash
cd webapp/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd webapp/frontend
npm install
npm run dev
```

## Execução com Docker Compose

O serviço `backend` usa `webapp/backend/.env` como fonte principal de configuração.

Trecho relevante:

```yaml
services:
  backend:
    env_file:
      - ./webapp/backend/.env
  frontend:
    build:
      args:
        VITE_BASE_PATH: /
        VITE_API_BASE_URL: /api
```

## Render

Variáveis já identificadas em [render.yaml](render.yaml):

- `DATABASE_URL` vindo do banco gerenciado
- `SECRET_KEY` gerada automaticamente
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `FRONTEND_URL`

Recomendação:

- complementar manualmente variáveis SMTP e DABB se forem necessárias no ambiente hospedado.

## Railway

O arquivo [railway.json](railway.json) define build e start, mas não explicita variáveis. Elas devem ser configuradas no painel do Railway.

Mínimo recomendado:

- `DATABASE_URL`
- `SECRET_KEY`
- `FRONTEND_URL`
- variáveis SMTP quando houver envio de convites ou aniversários

## Boas práticas

- Nunca versionar arquivos `.env` com segredos reais.
- Usar valores diferentes de `SECRET_KEY` por ambiente.
- Manter produção em HTTPS quando o frontend estiver público.
- Validar `GET /api/health` após qualquer mudança de configuração.
- Testar envio de e-mail e rotina de backup após configurar um novo ambiente.