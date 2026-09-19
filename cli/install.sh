#!/bin/sh
# Usage: curl -fsSL <origin>/install | sh -s -- <install-code>
set -eu
origin='__SKILLBOX_ORIGIN__'
code="${1:-}"
if [ -z "$code" ]; then
  echo "Usage: curl -fsSL $origin/install | sh -s -- <install-code>" >&2
  echo "Get an install code on $origin/devices" >&2
  exit 1
fi
if command -v node >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  runtime=node
elif command -v bun >/dev/null 2>&1; then
  runtime=bun
else
  echo "Jelou Skills needs Node.js 20+ or Bun. Install one (https://nodejs.org) and run this command again." >&2
  exit 1
fi
dir="$HOME/.local/share/jelou-skills"
mkdir -p "$dir"
for file in skillbox.mjs package.mjs setup.mjs; do
  curl -fsSL "$origin/cli/$file" -o "$dir/$file.download"
  mv "$dir/$file.download" "$dir/$file"
done
exec "$runtime" "$dir/skillbox.mjs" setup "$code" --origin "$origin"
