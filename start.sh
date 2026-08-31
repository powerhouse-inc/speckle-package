#!/usr/bin/env bash
# Bring up the whole local stack: Postgres, Speckle, and this package's
# Switchboard and Connect. Safe to re-run — it rebuilds only what changed.
#
#   ./start.sh              build if needed, start, wait for health
#   ./start.sh --no-build   start what is already built
#   ./start.sh --rebuild    force a rebuild without the layer cache
#   ./start.sh --debug      also start maildev (Speckle's outgoing mail)
#   ./start.sh --down       stop everything, keep the volumes
#   ./start.sh --down-all   stop everything and delete the volumes
set -euo pipefail

cd "$(dirname "$0")"

BUILD=1 NO_CACHE=0 PROFILES=() ACTION=up
for arg in "$@"; do
    case "$arg" in
        --no-build) BUILD=0 ;;
        --rebuild) NO_CACHE=1 ;;
        --debug) PROFILES+=(--profile debug) ;;
        --down) ACTION=down ;;
        --down-all) ACTION=down-all ;;
        -h | --help)
            sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "start.sh: unknown option '$arg' (try --help)" >&2
            exit 2
            ;;
    esac
done

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
die() {
    printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2
    exit 1
}

# --- Preflight ---------------------------------------------------------------

command -v docker >/dev/null 2>&1 || die "docker is not installed."
docker compose version >/dev/null 2>&1 || die "this needs Docker Compose v2 ('docker compose', not 'docker-compose')."
docker info >/dev/null 2>&1 || die "the Docker daemon is not reachable. Start Docker and try again."

if [ ! -f .env ]; then
    say "No .env yet — copying .env.example."
    cp .env.example .env
fi

# Read the ports we are about to bind. Only simple KEY=value lines, so a
# stray quote or space in .env cannot execute anything.
port_of() {
    local key=$1 fallback=$2 value
    value=$(sed -n "s/^${key}=\([^[:space:]#]*\).*/\1/p" .env | tail -1)
    printf '%s' "${value:-$fallback}"
}

SPECKLE_PORT=$(port_of SPECKLE_PORT 80)
CONNECT_PORT=$(port_of CONNECT_PORT 3000)
SWITCHBOARD_PORT=$(port_of SWITCHBOARD_PORT 4001)
POSTGRES_PORT=$(port_of POSTGRES_PORT 5432)
REDIS_PORT=$(port_of REDIS_PORT 6379)
MINIO_PORT=$(port_of MINIO_PORT 9000)
SPECKLE_ORIGIN=$(port_of SPECKLE_ORIGIN http://127.0.0.1)

# Speckle bakes its origin into what it serves, so SPECKLE_ORIGIN and
# SPECKLE_PORT must describe the same address. Disagreement is silent at boot
# and shows up much later as a frontend calling a server that is not there.
origin_hostport=${SPECKLE_ORIGIN#*//}
case "$origin_hostport" in
    *:*)
        origin_port=${origin_hostport##*:}
        SPECKLE_URL=$SPECKLE_ORIGIN
        ;;
    *)
        origin_port=80
        if [ "$SPECKLE_PORT" = 80 ]; then
            SPECKLE_URL=$SPECKLE_ORIGIN
        else
            SPECKLE_URL="$SPECKLE_ORIGIN:$SPECKLE_PORT"
        fi
        ;;
esac
if [ "$origin_port" != "$SPECKLE_PORT" ]; then
    die "SPECKLE_ORIGIN ($SPECKLE_ORIGIN) points at port $origin_port, but SPECKLE_PORT is $SPECKLE_PORT. Speckle serves its own origin to the browser, so the two must agree."
fi

if [ "$ACTION" = down ] || [ "$ACTION" = down-all ]; then
    if [ "$ACTION" = down-all ]; then
        say "Stopping the stack and deleting its volumes."
        docker compose "${PROFILES[@]+"${PROFILES[@]}"}" --profile debug down --volumes
    else
        say "Stopping the stack (volumes kept)."
        docker compose "${PROFILES[@]+"${PROFILES[@]}"}" --profile debug down
    fi
    exit 0
fi

# Ports held by someone who is not us. The usual culprit is a standalone
# Speckle stack, which binds 80, 5432, 6379 and 9000 — the same four.
#
# Ownership is decided from the ports our own containers actually publish, not
# by matching docker's human-readable port column: docker collapses adjacent
# mappings into a range ("127.0.0.1:9000-9001->9000-9001/tcp"), so a literal
# ":9000->" finds nothing and our own MinIO looks like a stranger.
published_ports() { # container ids on stdin -> one host port per line
    xargs -r docker inspect \
        --format '{{range $p, $bindings := .NetworkSettings.Ports}}{{range $bindings}}{{.HostPort}}
{{end}}{{end}}' 2>/dev/null | grep -E '^[0-9]+$' | sort -u
}

our_ports=$(docker compose ps -q 2>/dev/null | published_ports || true)

# Names the container holding a port, ranges included.
holder_of() {
    docker ps -q 2>/dev/null | xargs -r docker inspect \
        --format '{{$name := .Name}}{{range $p, $bindings := .NetworkSettings.Ports}}{{range $bindings}}{{$name}} {{.HostPort}}
{{end}}{{end}}' 2>/dev/null | awk -v p="$1" '$2 == p { print substr($1, 2); exit }'
}

busy=()
for entry in "SPECKLE_PORT:$SPECKLE_PORT" "CONNECT_PORT:$CONNECT_PORT" \
    "SWITCHBOARD_PORT:$SWITCHBOARD_PORT" "POSTGRES_PORT:$POSTGRES_PORT" \
    "REDIS_PORT:$REDIS_PORT" "MINIO_PORT:$MINIO_PORT"; do
    name=${entry%%:*} port=${entry##*:}

    # Our own container from a previous run: `up -d` reuses it.
    if printf '%s\n' "$our_ports" | grep -qx "$port"; then
        continue
    fi

    holder=$(holder_of "$port")
    if [ -n "$holder" ]; then
        busy+=("$port is held by the container '$holder' (\$$name)")
    elif command -v ss >/dev/null 2>&1 && ss -ltnH "sport = :$port" | grep -q .; then
        busy+=("$port is held by a process on the host (\$$name)")
    fi
done

if [ ${#busy[@]} -gt 0 ]; then
    warn "Port conflicts:"
    for line in "${busy[@]}"; do warn "  $line"; done
    other=$(docker compose ls -a --format json 2>/dev/null | grep -o '"Name":"[^"]*"' | sed 's/.*:"//;s/"//' | grep -v '^speckle-package$' | tr '\n' ' ')
    if [ -n "$other" ]; then
        warn "Other compose projects on this machine: $other"
    fi
    die "Stop whatever holds those ports (a standalone Speckle stack is the usual one), or change the ports in .env."
fi

# --- Up ---------------------------------------------------------------------

if [ "$NO_CACHE" = 1 ]; then
    say "Rebuilding switchboard and connect without the layer cache."
    docker compose build --no-cache switchboard connect
    BUILD=0
fi

say "Starting the stack."
if [ "$BUILD" = 1 ]; then
    docker compose "${PROFILES[@]+"${PROFILES[@]}"}" up -d --build
else
    docker compose "${PROFILES[@]+"${PROFILES[@]}"}" up -d
fi

# --- Wait -------------------------------------------------------------------

# Speckle's server needs the longest: migrations plus a first-boot warmup.
wait_for() {
    local label=$1 url=$2 timeout=$3 waited=0
    printf '    %-28s' "$label"
    while [ "$waited" -lt "$timeout" ]; do
        if curl -fsS -o /dev/null --max-time 3 "$url" 2>/dev/null; then
            printf '\033[1;32mready\033[0m (%ss)\n' "$waited"
            return 0
        fi
        sleep 3
        waited=$((waited + 3))
    done
    printf '\033[1;31mnot ready after %ss\033[0m\n' "$timeout"
    return 1
}

# Speckle's frontend answers well before its API does, and a seed script that
# starts too early gets a 404 from /auth. So ask the API itself.
wait_for_speckle_api() {
    local url=$1 timeout=$2 waited=0
    printf '    %-28s' "Speckle API"
    while [ "$waited" -lt "$timeout" ]; do
        if curl -fsS -o /dev/null --max-time 5 -X POST "$url/graphql" \
            -H 'content-type: application/json' \
            -d '{"query":"{serverInfo{version}}"}' 2>/dev/null; then
            printf '\033[1;32mready\033[0m (%ss)\n' "$waited"
            return 0
        fi
        sleep 3
        waited=$((waited + 3))
    done
    printf '\033[1;31mnot ready after %ss\033[0m\n' "$timeout"
    return 1
}

say "Waiting for the services to come up."
failed=0
wait_for "Speckle" "http://127.0.0.1:${SPECKLE_PORT}/" 300 || failed=1
wait_for_speckle_api "http://127.0.0.1:${SPECKLE_PORT}" 300 || failed=1
wait_for "Switchboard" "http://127.0.0.1:${SWITCHBOARD_PORT}/health" 240 || failed=1
wait_for "Connect" "http://127.0.0.1:${CONNECT_PORT}/health" 120 || failed=1

if [ "$failed" = 1 ]; then
    warn "Something did not come up. Logs:  docker compose logs -f"
    exit 1
fi

# --- Where to go next -------------------------------------------------------

cat <<INFO

  Speckle        ${SPECKLE_URL}
  Connect        http://localhost:${CONNECT_PORT}
  Switchboard    http://localhost:${SWITCHBOARD_PORT}
                 /graphql            documents
                 /graphql/analytics  the metric series
                 /mcp                reactor-mcp
  Postgres       postgres://localhost:${POSTGRES_PORT}  (databases: speckle, powerhouse)

INFO

if ! grep -q '^SPECKLE_TOKEN=..' .env; then
    cat <<'NEXT'
  Speckle is empty. To fill it with the demo — two projects with three months of
  revisions, plus a real IFC import, all mirrored into Powerhouse:

    node scripts/seed.mjs

  That registers a Speckle account and mints its own token, so there is nothing
  to click. It prints the credentials; put the token in .env as SPECKLE_TOKEN if
  you later want the runner to read private projects.

NEXT
fi

say "Up. Logs:  docker compose logs -f switchboard"
