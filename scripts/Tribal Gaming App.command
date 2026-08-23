#!/bin/bash
# Double-clickable launcher for the Tribal Gaming Compliance app (macOS).
#
# Starts PostgreSQL if needed, verifies the app is pointed at a database that
# actually has the current schema, builds if necessary, then serves the app and
# opens it in the browser. Safe to double-click repeatedly — if the server is
# already up it just reopens the tab.

set -uo pipefail

PROJECT_DIR="${TRIBAL_APP_DIR:-$HOME/tribal-gaming-app}"
PORT=3000
URL="http://localhost:$PORT"
PG_FORMULA="postgresql@15"

# Finder-launched shells can miss Homebrew's bin directories.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/local/opt/$PG_FORMULA/bin:$PATH"

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }

die() {
  red ""
  red "─────────────────────────────────────────────"
  red " $*"
  red "─────────────────────────────────────────────"
  echo ""
  echo "Press any key to close this window."
  read -r -n 1 -s
  exit 1
}

cd "$PROJECT_DIR" 2>/dev/null || die "Project not found at $PROJECT_DIR
Set TRIBAL_APP_DIR to its real location and try again."

echo "Tribal Gaming Compliance — starting up"
echo "Project: $PROJECT_DIR"
echo ""

# ── 1. Already running? ───────────────────────────────────────────────────────
if curl -fsS -m 2 -o /dev/null "$URL/login" 2>/dev/null; then
  grn "Already running — opening browser."
  open "$URL"
  exit 0
fi

command -v node >/dev/null || die "Node.js not found on PATH.
Install it from https://nodejs.org and try again."

# ── 2. Database URL: which file actually wins? ────────────────────────────────
# Next.js gives .env.local precedence over .env. A stale .env.local pointing at
# a different database is why queries fail with "column does not exist" even
# though migrations ran successfully against the local one.
DB_URL=""
for f in .env.local .env; do
  [ -f "$f" ] || continue
  line=$(grep -E '^[[:space:]]*DATABASE_URL=' "$f" | tail -1) || true
  if [ -n "$line" ]; then
    DB_URL=$(printf '%s' "$line" | sed -E 's/^[[:space:]]*DATABASE_URL=//; s/^"//; s/"$//')
    echo "DATABASE_URL comes from: $f"
    break
  fi
done
[ -n "$DB_URL" ] || die "No DATABASE_URL found in .env.local or .env."

case "$DB_URL" in
  *localhost*|*127.0.0.1*) IS_LOCAL=1 ;;
  *) IS_LOCAL=0 ;;
esac

# ── 3. Start PostgreSQL if this is a local database ───────────────────────────
if [ "$IS_LOCAL" = "1" ]; then
  if ! pg_isready -q -h localhost -p 5432 2>/dev/null; then
    echo "Starting PostgreSQL..."
    brew services start "$PG_FORMULA" >/dev/null 2>&1 \
      || pg_ctl -D "$(brew --prefix)/var/$PG_FORMULA" -l /tmp/tribal-postgres.log start >/dev/null 2>&1 \
      || true
    for _ in $(seq 1 20); do
      pg_isready -q -h localhost -p 5432 2>/dev/null && break
      sleep 1
    done
    pg_isready -q -h localhost -p 5432 2>/dev/null \
      || die "PostgreSQL would not start.
Try manually:  brew services start $PG_FORMULA
Then check:    tail /tmp/tribal-postgres.log"
  fi
  grn "PostgreSQL is up."
else
  ylw "Using a remote database (not localhost)."
fi

# ── 4. Schema check — the failure that looks like a code bug ──────────────────
echo "Checking database schema..."
PENDING=$(npx prisma migrate status 2>&1) || true
if printf '%s' "$PENDING" | grep -qi "not yet been applied\|pending"; then
  ylw "Applying pending migrations..."
  npx prisma migrate deploy || die "Migrations failed against:
  $DB_URL
This database is missing the app's schema."
fi

if ! npx prisma migrate status 2>&1 | grep -qi "up to date\|No pending"; then
  die "Database schema is out of sync with the app.

The app is pointed at:
  $DB_URL

If that is not the database you migrated, fix DATABASE_URL in .env.local
(it overrides .env) and run this launcher again."
fi
grn "Schema is current."

# ── 5. Warn (never auto-fix) if there are no accounts to log in with ──────────
# Deliberately read-only: `prisma db seed` begins by deleting every row, so
# running it automatically would destroy real exclusions and profiles on every
# launch. Seeding stays a manual, deliberate act.
if [ "$IS_LOCAL" = "1" ] && command -v psql >/dev/null 2>&1; then
  PSQL_URL=$(printf '%s' "$DB_URL" | sed -E 's/[?&]schema=[^&]*//; s/\?$//')
  USER_COUNT=$(psql "$PSQL_URL" -tAc 'SELECT COUNT(*) FROM "User";' 2>/dev/null | tr -d '[:space:]')
  if [ "$USER_COUNT" = "0" ]; then
    ylw ""
    ylw "This database has no user accounts, so you will not be able to log in."
    ylw "To load the demo data, quit and run:   npx prisma db seed"
    ylw "WARNING: that command deletes all existing rows first."
    ylw ""
  fi
fi

# ── 6. Build if needed ────────────────────────────────────────────────────────
NEEDS_BUILD=0
if [ ! -f .next/BUILD_ID ]; then
  NEEDS_BUILD=1
elif [ -n "$(find src prisma -type f -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]; then
  echo "Source changed since last build."
  NEEDS_BUILD=1
fi

if [ "$NEEDS_BUILD" = "1" ]; then
  echo "Building (first run takes ~30s)..."
  [ -d node_modules ] || npm install || die "npm install failed."
  npx prisma generate >/dev/null 2>&1
  npm run build || die "Build failed. Scroll up for the error."
  grn "Build complete."
else
  grn "Using existing build."
fi

# ── 7. Serve ──────────────────────────────────────────────────────────────────
# AUTH_TRUST_HOST is required by Auth.js when self-hosting outside a recognised
# platform; without it every auth route returns 500 (UntrustedHost).
export AUTH_TRUST_HOST=true
export NODE_ENV=production

echo ""
grn "Starting server on $URL"
npm start > /tmp/tribal-gaming-app.log 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 45); do
  curl -fsS -m 2 -o /dev/null "$URL/login" 2>/dev/null && break
  kill -0 "$SERVER_PID" 2>/dev/null || die "Server exited on startup:
$(tail -20 /tmp/tribal-gaming-app.log)"
  sleep 1
done

curl -fsS -m 2 -o /dev/null "$URL/login" 2>/dev/null || die "Server did not respond in time.
Log: /tmp/tribal-gaming-app.log"

open "$URL"

echo ""
grn "─────────────────────────────────────────────"
grn " Running at $URL"
grn "─────────────────────────────────────────────"
echo ""
echo "  Compliance:  compliance@demo.gov / demo-pass-2026"
echo "  Licensing:   licensing@demo.gov  / demo-pass-2026"
echo "  Applicant:   applicant@demo.gov  / demo-pass-2026"
echo ""
echo "Log: /tmp/tribal-gaming-app.log"
echo "Press Ctrl-C (or close this window) to stop the server."
echo ""

trap 'echo ""; echo "Stopping..."; kill $SERVER_PID 2>/dev/null; exit 0' INT TERM
wait $SERVER_PID
