#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://localhost/api/health}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-20}"
HEALTHCHECK_INTERVAL="${HEALTHCHECK_INTERVAL:-3}"
BACKUP_FILE="${BACKUP_FILE:-}"
ALLOW_DIRTY_WORKTREE="${ALLOW_DIRTY_WORKTREE:-0}"
SKIP_BACKUP_CHECK="${SKIP_BACKUP_CHECK:-0}"
EXPECTED_DATABASE_URL="${EXPECTED_DATABASE_URL:-sqlite:////data/associacao.db}"
EXPECTED_VOLUME_NAME="${EXPECTED_VOLUME_NAME:-backend_data}"

PREV_COMMIT_FILE="${APP_DIR}/.deploy_prev_commit"
LAST_SUCCESS_FILE="${APP_DIR}/.deploy_last_success_commit"
DEPLOY_STATE_DIR="${APP_DIR}/.deploy_state"
BACKUP_REGISTRY_FILE="${DEPLOY_STATE_DIR}/last_verified_backup.txt"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "ERRO: comando obrigatório não encontrado: ${cmd}"
    exit 1
  fi
}

ensure_state_dir() {
  mkdir -p "$DEPLOY_STATE_DIR"
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  log "ERRO: Docker Compose não encontrado (docker compose/docker-compose)."
  exit 1
}

resolve_backup_file() {
  if [[ -n "$BACKUP_FILE" ]]; then
    printf '%s\n' "$BACKUP_FILE"
    return 0
  fi

  local detected_backup
  detected_backup="$({ ls -1t "$APP_DIR"/unacob_backup_*.db 2>/dev/null || true; } | head -n 1)"
  if [[ -n "$detected_backup" ]]; then
    printf '%s\n' "$detected_backup"
  fi
}

verify_backup_file() {
  if [[ "$SKIP_BACKUP_CHECK" == "1" ]]; then
    log "AVISO: verificação de backup ignorada por SKIP_BACKUP_CHECK=1"
    return 0
  fi

  local backup_path
  backup_path="$(resolve_backup_file)"

  if [[ -z "$backup_path" ]]; then
    log "ERRO: nenhum backup encontrado. Informe BACKUP_FILE ou coloque um arquivo unacob_backup_*.db em ${APP_DIR}."
    exit 1
  fi

  if [[ ! -f "$backup_path" ]]; then
    log "ERRO: backup informado não existe: ${backup_path}"
    exit 1
  fi

  if [[ ! -s "$backup_path" ]]; then
    log "ERRO: backup informado está vazio: ${backup_path}"
    exit 1
  fi

  local checksum size_bytes
  checksum="$(sha256sum "$backup_path" | awk '{print $1}')"
  size_bytes="$(wc -c < "$backup_path" | tr -d ' ')"

  ensure_state_dir
  {
    echo "path=${backup_path}"
    echo "sha256=${checksum}"
    echo "size_bytes=${size_bytes}"
    echo "verified_at=$(date +'%Y-%m-%d %H:%M:%S')"
  } > "$BACKUP_REGISTRY_FILE"

  log "Backup validado: ${backup_path} (${size_bytes} bytes, sha256 ${checksum})"
}

verify_worktree() {
  if [[ "$ALLOW_DIRTY_WORKTREE" == "1" ]]; then
    log "AVISO: proteção de worktree sujo desativada por ALLOW_DIRTY_WORKTREE=1"
    return 0
  fi

  local worktree_changes
  worktree_changes="$(git -C "$APP_DIR" status --porcelain | grep -Ev '^(\?\?|A |M |AM|MM| D|D |R |C |UU) (\.deploy_state/|\.deploy_prev_commit$|\.deploy_last_success_commit$)' || true)"

  if [[ -n "$worktree_changes" ]]; then
    log "ERRO: há mudanças locais no servidor. Faça commit/stash/limpeza antes do deploy ou use ALLOW_DIRTY_WORKTREE=1 conscientemente."
    printf '%s\n' "$worktree_changes"
    exit 1
  fi
}

verify_database_url() {
  local env_file database_url
  env_file="$APP_DIR/webapp/backend/.env"

  if [[ ! -f "$env_file" ]]; then
    log "ERRO: arquivo de ambiente não encontrado: ${env_file}"
    exit 1
  fi

  database_url="$(grep -E '^DATABASE_URL=' "$env_file" | tail -n 1 | cut -d '=' -f 2-)"

  if [[ -z "$database_url" ]]; then
    log "ERRO: DATABASE_URL não encontrado em ${env_file}"
    exit 1
  fi

  if [[ "$database_url" != "$EXPECTED_DATABASE_URL" ]]; then
    log "ERRO: DATABASE_URL inesperado: ${database_url}"
    log "ERRO: esperado para deploy seguro com volume persistente: ${EXPECTED_DATABASE_URL}"
    exit 1
  fi

  log "DATABASE_URL validado para SQLite persistido em volume Docker"
}

verify_volume() {
  if docker volume inspect "$EXPECTED_VOLUME_NAME" >/dev/null 2>&1; then
    log "Volume persistente validado: ${EXPECTED_VOLUME_NAME}"
    return 0
  fi

  log "AVISO: volume ${EXPECTED_VOLUME_NAME} ainda não existe. Ele será criado no primeiro up e passará a persistir o banco a partir daí."
}

preflight() {
  require_cmd git
  require_cmd curl
  require_cmd sha256sum
  require_cmd wc
  compose_cmd >/dev/null

  verify_backup_file
  verify_worktree
  verify_database_url
  verify_volume
}

rollback() {
  local rollback_commit="${1:-}"
  local compose
  compose="$(compose_cmd)"

  if [[ -z "$rollback_commit" ]]; then
    if [[ -f "$PREV_COMMIT_FILE" ]]; then
      rollback_commit="$(cat "$PREV_COMMIT_FILE")"
    elif [[ -f "$LAST_SUCCESS_FILE" ]]; then
      rollback_commit="$(cat "$LAST_SUCCESS_FILE")"
    else
      log "ERRO: nenhum commit de rollback encontrado."
      exit 1
    fi
  fi

  log "Iniciando rollback para commit ${rollback_commit}"
  git -C "$APP_DIR" reset --hard "$rollback_commit"
  $compose -f "$APP_DIR/docker-compose.yml" down
  $compose -f "$APP_DIR/docker-compose.yml" up -d --build
  if healthcheck; then
    log "Rollback concluído para ${rollback_commit}"
    return 0
  fi

  log "ERRO: rollback concluído, mas o healthcheck continua falhando. Verifique o servidor manualmente."
  return 1
}

healthcheck() {
  log "Validando healthcheck: ${HEALTHCHECK_URL}"
  for ((i=1; i<=HEALTHCHECK_RETRIES; i++)); do
    if curl -fsS "$HEALTHCHECK_URL" >/dev/null 2>&1; then
      log "Healthcheck OK"
      return 0
    fi
    log "Tentativa ${i}/${HEALTHCHECK_RETRIES} falhou; aguardando ${HEALTHCHECK_INTERVAL}s"
    sleep "$HEALTHCHECK_INTERVAL"
  done
  return 1
}

deploy() {
  local compose current_commit new_commit
  compose="$(compose_cmd)"

  preflight

  current_commit="$(git -C "$APP_DIR" rev-parse HEAD)"
  echo "$current_commit" > "$PREV_COMMIT_FILE"

  log "Atualizando código de ${REMOTE}/${BRANCH}"
  git -C "$APP_DIR" fetch "$REMOTE"
  git -C "$APP_DIR" reset --hard "${REMOTE}/${BRANCH}"
  new_commit="$(git -C "$APP_DIR" rev-parse HEAD)"

  log "Subindo containers com build"
  $compose -f "$APP_DIR/docker-compose.yml" down
  $compose -f "$APP_DIR/docker-compose.yml" up -d --build

  if healthcheck; then
    echo "$new_commit" > "$LAST_SUCCESS_FILE"
    log "Deploy concluído com sucesso em ${new_commit}"
    $compose -f "$APP_DIR/docker-compose.yml" ps
    exit 0
  fi

  log "Healthcheck falhou. Executando rollback automático..."
  rollback "$current_commit"
  exit 1
}

usage() {
  cat <<EOF
Uso:
  ./deploy.sh                 # deploy com rollback automático
  ./deploy.sh rollback        # rollback para commit anterior salvo
  ./deploy.sh rollback <sha>  # rollback para commit específico

Variáveis opcionais:
  APP_DIR=/caminho/projeto
  REMOTE=origin
  BRANCH=main
  HEALTHCHECK_URL=http://localhost/api/health
  HEALTHCHECK_RETRIES=20
  HEALTHCHECK_INTERVAL=3
  BACKUP_FILE=/caminho/para/unacob_backup_YYYYMMDD_HHMMSS.db
  SKIP_BACKUP_CHECK=0
  ALLOW_DIRTY_WORKTREE=0
  EXPECTED_DATABASE_URL=sqlite:////data/associacao.db
  EXPECTED_VOLUME_NAME=backend_data
EOF
}

main() {
  cd "$APP_DIR"

  case "${1:-deploy}" in
    deploy)
      deploy
      ;;
    rollback)
      rollback "${2:-}"
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      log "Comando inválido: $1"
      usage
      exit 1
      ;;
  esac
}

main "$@"
