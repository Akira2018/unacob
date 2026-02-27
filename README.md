# UNACOB - Preparação para Deploy e Testes

Este projeto está preparado para testes no GitHub com CI automática e execução separada de backend (FastAPI) e frontend (Vite/React).

## Estrutura

- `webapp/backend`: API FastAPI
- `webapp/frontend`: aplicação React
- `.github/workflows/ci.yml`: pipeline de validação em push/PR

## Variáveis de ambiente (backend)

Copie o arquivo de exemplo:

```bash
cd webapp/backend
cp .env.example .env
```

No Windows PowerShell:

```powershell
cd webapp/backend
Copy-Item .env.example .env
```

Principais variáveis:

- `SECRET_KEY`: chave JWT da aplicação
- `ACCESS_TOKEN_EXPIRE_MINUTES`: duração do token
- `DATABASE_URL`: string de conexão (SQLite por padrão)

## Rodar localmente

### Backend

```bash
cd webapp/backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `GET /api/health`

### Frontend

```bash
cd webapp/frontend
npm install
npm run dev
```

## Publicar no GitHub

1) Crie um repositório vazio no GitHub (sem README inicial).

2) No diretório raiz do projeto, execute:

```bash
git init
git add .
git commit -m "chore: preparar projeto para deploy e CI"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

3) Se algum `.env` já tiver sido adicionado ao Git por engano, remova do índice antes do push:

```bash
git rm --cached webapp/backend/.env
git commit -m "chore: remover .env versionado"
```

No PowerShell, caso exista também um `.env` na raiz:

```powershell
if (Test-Path .env) { git rm --cached .env }
```

Após o push, a pipeline de CI será executada automaticamente no GitHub Actions.

## Checklist de deploy

- Backend usa variáveis de ambiente de `webapp/backend/.env`.
- Frontend suporta `VITE_API_BASE_URL` (padrão `/api`).
- Endpoint de health check disponível em `GET /api/health`.
- `.gitignore` bloqueia `.env`, bancos locais e ambientes virtuais.

## CI configurada

Arquivo: `.github/workflows/ci.yml`

- Job `backend`:
  - instala dependências Python
  - faz smoke test com import da API
- Job `frontend`:
  - instala dependências com `npm ci`
  - gera build de produção (`npm run build`)

## Próximo passo sugerido

Se quiser, posso configurar também um deploy automatizado em plataforma gratuita (Render/Railway/Vercel) com guia passo a passo e variáveis já mapeadas.
