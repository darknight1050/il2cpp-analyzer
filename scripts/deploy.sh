#!/usr/bin/env bash
#
# Deploys the latest code to the running docker compose stack.
#
# Only the app container is rebuilt and replaced - Elasticsearch and MongoDB
# keep running untouched, so a code deploy never risks the data. If the new
# container does not come up healthy, the previously running image is put back
# and the checkout is restored.
#
#   ./scripts/deploy.sh              deploy origin's latest
#   ./scripts/deploy.sh --no-pull    rebuild and redeploy the current checkout
#
set -euo pipefail

cd "$(dirname "$0")/.."

SERVICE=app
PULL=1
[ "${1:-}" = "--no-pull" ] && PULL=0

compose() { docker compose "$@"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

# --- sanity checks ----------------------------------------------------------
command -v docker >/dev/null || fail "docker is not installed"
[ -f .env ] || fail ".env is missing - copy .env.example and fill it in"
[ -z "$(git status --porcelain)" ] || \
    fail "working tree has uncommitted changes; commit or stash them first"

PREV_COMMIT=$(git rev-parse HEAD)
echo "==> Current commit: $(git rev-parse --short HEAD)"

# Remember exactly what is running now so we can put it back on failure. This
# is the image, not the commit: it works even with --no-pull, and rolling back
# is then a retag rather than a rebuild.
PREV_CID=$(compose ps -q "$SERVICE" 2>/dev/null || true)
IMAGE_NAME=""
ROLLBACK_TAG=""
if [ -n "$PREV_CID" ]; then
    PREV_IMAGE_ID=$(docker inspect -f '{{.Image}}' "$PREV_CID" 2>/dev/null || true)
    IMAGE_NAME=$(docker inspect -f '{{.Config.Image}}' "$PREV_CID" 2>/dev/null || true)
    if [ -n "$PREV_IMAGE_ID" ] && [ -n "$IMAGE_NAME" ]; then
        # Give the running image its own tag BEFORE building. The build reuses
        # the :latest tag, which would leave the old image dangling and liable
        # to be pruned - by which point there is nothing left to roll back to.
        ROLLBACK_TAG="${IMAGE_NAME%%:*}:rollback"
        docker tag "$PREV_IMAGE_ID" "$ROLLBACK_TAG"
        echo "    Saved current image as $ROLLBACK_TAG"
    fi
else
    echo "    No app container running yet - nothing to roll back to."
fi

# --- fetch new code ---------------------------------------------------------
if [ "$PULL" = "1" ]; then
    echo "==> Pulling latest code"
    git pull --ff-only
    NEW_COMMIT=$(git rev-parse HEAD)
    if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
        echo "    Already up to date; rebuilding anyway."
    else
        echo "    $(git rev-parse --short "$PREV_COMMIT") -> $(git rev-parse --short "$NEW_COMMIT")"
        git --no-pager log --oneline "$PREV_COMMIT..$NEW_COMMIT" | sed 's/^/      /'
    fi
fi

# --- wait for the app container to report healthy ---------------------------
wait_healthy() {
    local cid deadline status restarts
    cid=$(compose ps -q "$SERVICE")
    [ -n "$cid" ] || return 1
    # loadVersions() scans the whole symbol cache before the server listens,
    # so allow plenty of time on a large cache.
    deadline=$(( $(date +%s) + 900 ))
    while [ "$(date +%s)" -lt "$deadline" ]; do
        status=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)
        case "$status" in
            healthy) return 0 ;;
            missing) return 1 ;;
        esac
        # A container that keeps crashing will never turn healthy, and with
        # restart:unless-stopped it would otherwise spin until the deadline.
        restarts=$(docker inspect -f '{{.RestartCount}}' "$cid" 2>/dev/null || echo 0)
        if [ "${restarts:-0}" -ge 3 ]; then
            echo "    container restarted ${restarts} times - giving up" >&2
            return 1
        fi
        sleep 5
    done
    echo "    timed out waiting for a healthy status" >&2
    return 1
}

# --- build and swap ---------------------------------------------------------
echo "==> Building image"
compose build "$SERVICE"

echo "==> Replacing app container (databases untouched)"
compose up -d --no-deps "$SERVICE"

echo "==> Waiting for health check"
if wait_healthy; then
    echo "==> Deployed successfully: $(git rev-parse --short HEAD)"
    compose ps
    exit 0
fi

# --- rollback ---------------------------------------------------------------
echo "" >&2
echo "Deploy FAILED. Last 40 log lines:" >&2
compose logs --tail 40 "$SERVICE" 2>&1 | sed 's/^/    /' >&2
echo "" >&2

# Restore the checkout first so the tree matches whatever we put back.
if [ "$(git rev-parse HEAD)" != "$PREV_COMMIT" ]; then
    echo "==> Restoring checkout to $(git rev-parse --short "$PREV_COMMIT")" >&2
    git reset --hard "$PREV_COMMIT"
fi

if [ -z "$ROLLBACK_TAG" ] || ! docker image inspect "$ROLLBACK_TAG" >/dev/null 2>&1; then
    fail "deploy failed and there is no previous image to roll back to - fix the code and re-run"
fi

echo "==> Rolling back to $ROLLBACK_TAG" >&2
docker tag "$ROLLBACK_TAG" "${IMAGE_NAME%%:*}:latest"
compose up -d --no-deps --force-recreate "$SERVICE"

if wait_healthy; then
    fail "deploy failed; rolled back to the previous image and it is healthy again"
fi
fail "deploy failed AND the rollback did not come up healthy - manual intervention needed"
