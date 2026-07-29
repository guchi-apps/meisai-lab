#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT_DIR/scripts/ensure-mysql.sh"

# shellcheck source=scripts/dev-wsl-lan.sh
source "$ROOT_DIR/scripts/dev-wsl-lan.sh"

setup_wsl_lan_dev_access "$PORT" "$ROOT_DIR"

export DEV_ALLOWED_ORIGINS="${DEV_ALLOWED_ORIGINS:-}"

exec next dev -H 0.0.0.0 -p "${PORT}"
