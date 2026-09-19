#!/bin/sh
set -eu
# Fly mounts volumes root-owned; this runs as root and drops to `bun` for the server.
if [ ! -f /data/pglite/PG_VERSION ]; then
  rm -rf /data/pglite.tmp
  cp -a /app/pglite-template /data/pglite.tmp
  mv /data/pglite.tmp /data/pglite
fi
chown -R bun:bun /data
exec setpriv --reuid=bun --regid=bun --init-groups bun src/server/index.ts
