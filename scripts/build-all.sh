#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICES=(auth orders tickets expiration payments)
for service in "${SERVICES[@]}"; do
    echo "=== $service ==="
    (cd "$REPO_ROOT/$service" && npm install && npm run build)
    echo "=== $service PASSED ==="
    echo
done

echo "All services built."
