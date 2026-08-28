#!/bin/sh
set -e

# Prisma is only present in images built from a published package, and only
# while document-drive still ships a schema. Skip it when either is missing
# rather than failing the boot.
PRISMA_SCHEMA="node_modules/document-drive/dist/prisma/schema.prisma"
if command -v prisma >/dev/null 2>&1 && [ -f "$PRISMA_SCHEMA" ]; then
    echo "[entrypoint] Regenerating Prisma client for current platform..."
    prisma generate --schema "$PRISMA_SCHEMA"

    if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "^postgres" && [ "$SKIP_DB_MIGRATIONS" != "true" ]; then
        echo "[entrypoint] Running Prisma db push..."
        prisma db push --schema "$PRISMA_SCHEMA" --skip-generate
    fi
else
    echo "[entrypoint] No Prisma schema in document-drive — skipping Prisma steps."
fi

# The reactor's own migrations are independent of Prisma.
if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "^postgres" && [ "$SKIP_DB_MIGRATIONS" != "true" ]; then
    echo "[entrypoint] Running migrations..."
    ph switchboard --migrate
fi

# The local (directory) package can only be loaded by a dev server that
# compiles TypeScript. In an image the package is installed under its own name
# via PH_PACKAGES, so skip the attempt rather than log its failure.
EXTRA=""
if [ "${PH_IGNORE_LOCAL:-false}" = "true" ]; then
    EXTRA="--ignore-local"
fi

echo "[entrypoint] Starting switchboard on port ${PORT:-3000}..."
exec ph switchboard --port ${PORT:-3000} $EXTRA
