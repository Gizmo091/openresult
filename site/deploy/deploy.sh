#!/usr/bin/env bash
#
# Deploy openresult.dev.
#
# Builds everything, ships it as one archive, unpacks it into a timestamped
# release and moves a symlink. The old release stays on disk, so going back is
# one `ln -sfn` — which matters at the hour when a deployment usually goes
# wrong.
#
#   ./site/deploy/deploy.sh              deploy the working tree
#   ./site/deploy/deploy.sh --rollback   point `current` at the previous release
#
set -euo pipefail

HOST="${OPENRESULT_HOST:-openresult_ovh}"
REMOTE_ROOT=/srv/openresult
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"

say() { printf '\033[36m▸\033[0m %s\n' "$*"; }

if [[ "${1:-}" == "--rollback" ]]; then
  say "Rolling back on $HOST"
  ssh "$HOST" 'set -e
    cd '"$REMOTE_ROOT"'/releases
    current=$(basename "$(readlink '"$REMOTE_ROOT"'/current)")
    previous=$(ls -1 | grep -v "^$current$" | sort | tail -1)
    [ -n "$previous" ] || { echo "No earlier release to fall back to." >&2; exit 1; }
    sudo ln -sfn '"$REMOTE_ROOT"'/releases/"$previous" '"$REMOTE_ROOT"'/current
    sudo systemctl restart openresult
    echo "Now serving $previous"'
  exit 0
fi

# A deployment that skips the checks is how a broken build reaches the internet.
say "Checking the working tree"
cd "$repo"
pnpm build >/dev/null
pnpm lint >/dev/null
pnpm typecheck >/dev/null
pnpm check >/dev/null
pnpm conformance >/dev/null
say "Checks passed"

say "Assembling the release"
"$here/build-release.sh" >/dev/null
stamp="$(date -u +%Y%m%d-%H%M%S)"
archive="$(mktemp -t openresult-release-XXXXXX).tgz"
tar -czf "$archive" -C "$repo/site/release" .
say "Release $stamp ($(du -h "$archive" | cut -f1))"

say "Shipping to $HOST"
scp -q "$archive" "$HOST:$REMOTE_ROOT/incoming/release.tgz"
rm -f "$archive"

ssh "$HOST" "set -e
  sudo rm -rf $REMOTE_ROOT/releases/$stamp
  sudo mkdir -p $REMOTE_ROOT/releases/$stamp
  sudo tar -xzf $REMOTE_ROOT/incoming/release.tgz -C $REMOTE_ROOT/releases/$stamp
  sudo chown -R openresult:openresult $REMOTE_ROOT/releases/$stamp
  rm -f $REMOTE_ROOT/incoming/release.tgz

  sudo ln -sfn $REMOTE_ROOT/releases/$stamp $REMOTE_ROOT/current
  sudo systemctl restart openresult

  # Keep the four most recent releases: enough to fall back through a bad run,
  # not enough to fill the disk.
  cd $REMOTE_ROOT/releases && ls -1 | sort | head -n -4 | xargs -r sudo rm -rf"

say "Waiting for the service"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null https://openresult.dev/healthz; then break; fi
  sleep 1
done

deployed="$(curl -fsS https://openresult.dev/VERSION)"
expected="$(git -C "$repo" rev-parse HEAD)"
if [[ "$deployed" != "$expected" ]]; then
  echo "Deployed $deployed but expected $expected." >&2
  exit 1
fi

say "Live: $(git -C "$repo" rev-parse --short HEAD)"
for path in / /spec/ /examples/ /view/ /validate/ /docs/ /playground/ /validator/ /schema/openresult-1.0.schema.json; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "https://openresult.dev$path")"
  printf '  %-44s %s\n' "$path" "$code"
  [[ "$code" == "200" ]] || { echo "  ↑ not 200 — check it" >&2; exit 1; }
done
