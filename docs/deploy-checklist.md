# Checklist de Deploy e Pós-Deploy

## Objetivo

Este checklist organiza a publicação do sistema com foco em segurança básica, disponibilidade e capacidade de rollback.

## 1. Pré-deploy

### Código e branch

- Confirmar a branch que será publicada.
- Verificar se o repositório remoto está acessível.
- Validar se não há mudanças locais não intencionais no servidor de deploy.
- Garantir que a versão a publicar passou pela CI do repositório.

### Backend

- Confirmar `DATABASE_URL` do ambiente alvo.
- Confirmar `SECRET_KEY` diferente do valor de exemplo.
- Revisar `FRONTEND_URL` ou `FRONTEND_BASE_URL`.
- Validar variáveis SMTP se houver envio de convites ou aniversários.
- Validar configuração de backup e retenção.
- Conferir permissões de leitura e escrita nas pastas de dados e backup.

### Frontend

- Confirmar `VITE_API_BASE_URL` ou uso de `/api` com proxy reverso.
- Conferir `VITE_BASE_PATH` conforme o ambiente de publicação.

### Banco e dados

- Executar backup antes da publicação.
- Verificar espaço em disco.
- Conferir integridade da base se o ambiente usa SQLite.
- Validar se há plano de rollback do banco, quando aplicável.

## 2. Deploy com Docker Compose

Baseado em [docker-compose.yml](docker-compose.yml) e [deploy.sh](deploy.sh).

### Pré-requisitos

- Docker e Docker Compose instalados.
- Arquivo `webapp/backend/.env` configurado no servidor.
- Volume persistente disponível para `/data`.
- Endpoint `http://localhost/api/health` acessível a partir do host, ou `HEALTHCHECK_URL` ajustado.

### Publicação usando script

```bash
./deploy.sh
```

O script atual:

- salva o commit anterior;
- busca a branch remota configurada;
- executa `docker compose down` e `docker compose up -d --build`;
- valida o healthcheck;
- faz rollback automático se o healthcheck falhar.

### Variáveis úteis do script

- `APP_DIR`
- `REMOTE`
- `BRANCH`
- `HEALTHCHECK_URL`
- `HEALTHCHECK_RETRIES`
- `HEALTHCHECK_INTERVAL`

### Rollback manual

```bash
./deploy.sh rollback
./deploy.sh rollback <sha>
```

## 3. Deploy no Render

Baseado em [render.yaml](render.yaml).

### Itens mínimos

- serviço web apontando para `webapp/backend`;
- `DATABASE_URL` vindo do banco gerenciado;
- `SECRET_KEY` gerada automaticamente ou definida manualmente;
- `ACCESS_TOKEN_EXPIRE_MINUTES` configurado;
- `FRONTEND_URL` com domínio público do frontend.

### Verificações adicionais

- completar variáveis SMTP e DABB se forem usadas no ambiente;
- confirmar `healthCheckPath` em `/api/health`;
- validar logs de inicialização após o deploy.

## 4. Deploy no Railway

Baseado em [railway.json](railway.json).

### Itens mínimos

- configurar `DATABASE_URL` no painel;
- configurar `SECRET_KEY`;
- configurar `FRONTEND_URL`;
- revisar variáveis SMTP quando aplicável.

### Verificações adicionais

- confirmar `startCommand` do backend;
- validar `healthcheckPath` em `/api/health`;
- revisar logs de aplicação e restart policy.

## 5. Pós-deploy imediato

- Acessar `GET /api/health`.
- Confirmar login de um usuário válido.
- Abrir painel principal.
- Testar consulta de associados.
- Testar consulta de pagamentos.
- Validar pelo menos um relatório simples.
- Se houver SMTP configurado, testar uma operação de envio controlada.
- Confirmar que o frontend está consumindo a API correta.

## 6. Pós-deploy financeiro e operacional

- Verificar se relatórios Excel continuam sendo gerados.
- Verificar se importações de extrato continuam aceitas.
- Verificar se a área administrativa lista backups.
- Confirmar que o banco está persistindo dados após reinício.

## 7. Sinais de falha que exigem rollback

- `GET /api/health` indisponível.
- erro de autenticação generalizado após deploy.
- falha de conexão com banco.
- geração de relatórios quebrada.
- importações críticas falhando em massa.
- frontend sem comunicação com a API.

## 8. Checklist rápido de liberação

- Código validado
- Variáveis de ambiente conferidas
- Backup executado
- Deploy concluído
- Healthcheck aprovado
- Login testado
- Fluxo principal testado
- Rollback disponível