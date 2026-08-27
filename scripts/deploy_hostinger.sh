#!/usr/bin/env bash
# =============================================================================
# deploy_hostinger.sh  -  Deploy do UNACOB no VPS Hostinger (/opt/unacob)
# =============================================================================
# Uso (no servidor, dentro de /opt/unacob):
#
#   ./scripts/deploy_hostinger.sh
#       -> deploy normal: git reset --hard origin/main + rebuild + health check
#
#   ./scripts/deploy_hostinger.sh --reset-mensalidades
#       -> idem + zera o dominio "recebimento de mensalidades" UMA vez
#          (cria marcador /data/.reset_mensalidades_done; nao repete)
#
#   FORCE_RESET=1 ./scripts/deploy_hostinger.sh --reset-mensalidades
#       -> roda o reset mesmo que o marcador ja exista
#
# Variaveis opcionais: REPO_DIR (/opt/unacob), DOMAIN (https://unacobadmin.com.br)
#
# GARANTIA: se o script parar o backend para o reset e algo falhar depois,
# o trap de saida sempre tenta subir o backend de novo (nunca deixa fora do ar).
# O health check ao final apenas avisa; nao derruba o deploy.
# =============================================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/unacob}"
DOMAIN="${DOMAIN:-https://unacobadmin.com.br}"
FORCE_RESET="${FORCE_RESET:-0}"
DB_IN_CONTAINER="/data/associacao.db"

DO_RESET=0
for arg in "$@"; do
  [ "$arg" = "--reset-mensalidades" ] && DO_RESET=1
done

cd "$REPO_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
BKP="$REPO_DIR/associacao.db.bak-${TS}"
PREV_COMMIT=""
BACKEND_STOPPED=0

if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi

backend_running() {
  # Confiavel: pega o(s) container(s) do servico e checa State.Running via docker inspect.
  local ids
  ids="$($DC ps -q backend 2>/dev/null)" || return 1
  [ -n "$ids" ] || return 1
  docker inspect -f '{{.State.Running}}' $ids 2>/dev/null | grep -qx true
}

# ----------------------------------------------------------------------------
# Rede de seguranca: roda SEMPRE ao sair (sucesso ou falha).
#  - se paramos o backend e ele nao esta de pe, sobe de novo;
#  - em caso de falha, imprime instrucoes de rollback.
# ----------------------------------------------------------------------------
on_exit() {
  rc=$?
  set +e
  if [ "$BACKEND_STOPPED" = 1 ] && ! backend_running; then
    echo ">> recuperacao: backend fora do ar, subindo novamente ..."
    $DC up -d --build backend || $DC up -d backend || $DC start backend
  fi
  if [ "$rc" -ne 0 ]; then
    echo ""
    echo "!! DEPLOY FALHOU (rc=$rc)."
    echo "!! Restaurar o banco (se o reset tocou nele):"
    echo "     $DC stop backend && $DC cp \"$BKP\" backend:$DB_IN_CONTAINER && $DC start backend"
    [ -n "$PREV_COMMIT" ] && echo "!! Voltar o codigo:  git reset --hard $PREV_COMMIT"
  fi
  exit "$rc"
}
trap on_exit EXIT

echo ">> compose ...... $DC"
echo ">> repo ......... $REPO_DIR"
echo ">> reset ........ $([ "$DO_RESET" = 1 ] && echo SIM || echo nao)"

# ----------------------------------------------------------------------------
# 1) Atualiza o codigo
# ----------------------------------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
  echo ">> AVISO: ha alteracoes locais no servidor; serao descartadas pelo reset --hard"
  git status --porcelain
fi
git fetch origin
PREV_COMMIT="$(git rev-parse HEAD)"
git reset --hard origin/main
NEW_COMMIT="$(git rev-parse HEAD)"
echo ">> codigo ....... $PREV_COMMIT -> $NEW_COMMIT"

# ----------------------------------------------------------------------------
# 2) Backup do banco de producao
#    Tenta o cp direto (funciona com o container de pe ou parado); se nao houver
#    container, cai para um container efemero montando o volume.
# ----------------------------------------------------------------------------
echo ">> backup ....... $BKP"
if $DC cp "backend:$DB_IN_CONTAINER" "$BKP" 2>/dev/null && [ -s "$BKP" ]; then
  echo ">> backup ....... ok (cp direto)"
else
  rm -f "$BKP"
  echo ">> backup ....... cp direto indisponivel; via container efemero"
  $DC run --rm --no-deps -T -v "$REPO_DIR:/host" backend \
    sh -c "cp $DB_IN_CONTAINER /host/$(basename "$BKP")" || echo "   (sem banco previo - primeira subida?)"
fi

# ----------------------------------------------------------------------------
# 3) Reset do dominio "recebimento de mensalidades" (opcional, 1x)
# ----------------------------------------------------------------------------
if [ "$DO_RESET" = 1 ]; then
  echo ">> reset ........ parando backend"
  $DC stop backend || true
  BACKEND_STOPPED=1

  echo ">> reset ........ aplicando scripts/reset_recebimento_mensalidades.sql"
  FORCE_RESET="$FORCE_RESET" $DC run --rm --no-deps -T \
    -e FORCE_RESET \
    -v "$REPO_DIR/scripts:/reset:ro" \
    backend python - <<'PY'
import os, sqlite3, sys

db_path = "/data/associacao.db"
marker  = "/data/.reset_mensalidades_done"
force   = os.environ.get("FORCE_RESET", "0") == "1"

if os.path.exists(marker) and not force:
    print("   SKIP: reset ja executado antes (%s). Use FORCE_RESET=1 para repetir." % marker)
    sys.exit(0)

sql = open("/reset/reset_recebimento_mensalidades.sql", "r", encoding="utf-8").read()
con = sqlite3.connect(db_path)
con.executescript(sql)

cur = con.cursor()
checks = [
    ("pagamentos",            "SELECT COUNT(*) FROM pagamentos"),
    ("transacoes_mensalidade","SELECT COUNT(*) FROM transacoes WHERE origem IN ('mensalidade','BB-PDF')"),
    ("conciliacoes_credito",  "SELECT COUNT(*) FROM conciliacoes WHERE tipo='credito'"),
    ("dabb_remessas",         "SELECT COUNT(*) FROM dabb_remessas"),
    ("dabb_remessa_itens",    "SELECT COUNT(*) FROM dabb_remessa_itens"),
    ("seq_dabb",              "SELECT valor FROM configuracoes_sistema WHERE chave='dabb_ultimo_sequencial'"),
    ("despesas (mantido)",    "SELECT COUNT(*) FROM despesas"),
    ("conciliacoes_debito (mantido)", "SELECT COUNT(*) FROM conciliacoes WHERE tipo='debito'"),
    ("membros (mantido)",     "SELECT COUNT(*) FROM membros"),
]
print("   --- verificacao ---")
for nome, q in checks:
    print("   %-32s %s" % (nome, cur.execute(q).fetchone()[0]))

fk = cur.execute("PRAGMA foreign_key_check").fetchall()
print("   foreign_key_check ................ %s" % (fk or "OK"))
print("   integrity_check .................. %s" % cur.execute("PRAGMA integrity_check").fetchone()[0])

con.close()
open(marker, "w").write("done\n")
print("   RESET OK")
PY
fi

# ----------------------------------------------------------------------------
# 4) Rebuild + subida (traz o backend de volta se foi parado no passo 3)
# ----------------------------------------------------------------------------
echo ">> build ........ $DC up -d --build"
$DC up -d --build
BACKEND_STOPPED=0
$DC ps

# ----------------------------------------------------------------------------
# 5) Health check (SO AVISA - nunca derruba o deploy)
# ----------------------------------------------------------------------------
echo ">> aguardando backend responder ..."
HEALTH="(sem resposta)"
for _ in $(seq 1 20); do
  if curl -fsS "$DOMAIN/api/health" >/dev/null 2>&1; then
    HEALTH="$(curl -fsS "$DOMAIN/api/health" 2>/dev/null || echo '(sem resposta)')"
    break
  fi
  sleep 3
done
echo ">> /api/health .. $HEALTH"
CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$DOMAIN/api/pagamentos/painel?mes_referencia=$(date +%Y-%m)" || true)"
echo ">> /api/pagamentos/painel -> $CODE  (200 = ok; 401/403 tambem indica backend no ar)"

case "$HEALTH" in
  *'"status"'*'"ok"'*) : ;;
  *) echo "!! ATENCAO: /api/health nao confirmou OK. Rode: $DC logs --tail=80 backend" ;;
esac

echo ""
echo ">> DEPLOY CONCLUIDO  ($NEW_COMMIT)"
echo ">> backup do banco: $BKP"
