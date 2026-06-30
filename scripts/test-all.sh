#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICES=(auth orders tickets payments)
for service in "${SERVICES[@]}"; do
    echo "=== $service ==="
    (cd "$REPO_ROOT/$service" && npm test)
    echo "=== $service PASSED ==="
    echo
done

echo "All services passed."
