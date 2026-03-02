#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://localhost/api/health}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-20}"
HEALTHCHECK_INTERVAL="${HEALTHCHECK_INTERVAL:-3}"

PREV_COMMIT_FILE="${APP_DIR}/.deploy_prev_commit"
LAST_SUCCESS_FILE="${APP_DIR}/.deploy_last_success_commit"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
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
  log "Rollback concluído para ${rollback_commit}"
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
