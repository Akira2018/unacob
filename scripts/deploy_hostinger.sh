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
# =============================================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/unacob}"
DOMAIN="${DOMAIN:-https://unacobadmin.com.br}"
FORCE_RESET="${FORCE_RESET:-0}"
DB_IN_CONTAINER="/data/associacao.db"
RESET_MARKER="/data/.reset_mensalidades_done"

DO_RESET=0
for arg in "$@"; do
  [ "$arg" = "--reset-mensalidades" ] && DO_RESET=1
done

cd "$REPO_DIR"
TS="$(date +%Y%m%d_%H%M%S)"

if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
echo ">> compose ...... $DC"
echo ">> repo ......... $REPO_DIR"
echo ">> reset ........ $([ "$DO_RESET" = 1 ] && echo SIM || echo nao)"

BKP="$REPO_DIR/associacao.db.bak-${TS}"
rollback_hint() {
  echo ""
  echo "!! FALHA no deploy."
  echo "!! Para restaurar o banco (se algo tocou nele):"
  echo "     $DC stop backend"
  echo "     $DC cp \"$BKP\" backend:$DB_IN_CONTAINER"
  echo "     $DC start backend"
  echo "!! Para voltar o codigo:  git reset --hard \$PREV_COMMIT"
}
trap rollback_hint ERR

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
# 2) Backup do banco de producao (se o backend estiver rodando)
# ----------------------------------------------------------------------------
if $DC ps 2>/dev/null | grep -Eq 'backend.*(Up|running)'; then
  echo ">> backup ....... $BKP"
  $DC cp "backend:$DB_IN_CONTAINER" "$BKP"
else
  echo ">> backup ....... backend parado; tentando backup via volume"
  $DC run --rm --no-deps -T -v "$REPO_DIR:/host" backend \
    sh -c "cp $DB_IN_CONTAINER /host/$(basename "$BKP")" || echo "   (sem banco previo - primeira subida?)"
fi

# ----------------------------------------------------------------------------
# 3) Reset do dominio "recebimento de mensalidades" (opcional, 1x)
# ----------------------------------------------------------------------------
if [ "$DO_RESET" = 1 ]; then
  echo ">> reset ........ parando backend"
  $DC stop backend || true

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
# 4) Rebuild + subida
# ----------------------------------------------------------------------------
echo ">> build ........ $DC up -d --build"
$DC up -d --build
$DC ps

# ----------------------------------------------------------------------------
# 5) Health checks
# ----------------------------------------------------------------------------
echo ">> aguardando backend responder ..."
OK=0
for i in $(seq 1 15); do
  if curl -fsS "$DOMAIN/api/health" >/dev/null 2>&1; then OK=1; break; fi
  sleep 3
done
[ "$OK" = 1 ] || { echo "!! /api/health nao respondeu apos ~45s"; false; }
echo -n ">> /api/health .. "
curl -fsS "$DOMAIN/api/health"; echo
CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$DOMAIN/api/conciliacao" || true)"
echo ">> /api/conciliacao -> $CODE  (401/403 = esperado, rota autenticada)"

trap - ERR
echo ""
echo ">> DEPLOY OK  ($NEW_COMMIT)"
echo ">> backup do banco: $BKP"
