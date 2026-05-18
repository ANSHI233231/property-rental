#!/bin/bash
# Smoke test the running NestJS API end-to-end against a fresh seed.
#
# Usage:
#   ADMIN_EMAIL=admin@triline.co ADMIN_PASSWORD='Password#123' ./smoke.sh
#
# Both env vars MUST match what the seed created (see apps/api/.env →
# BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD). If unset, defaults below
# match the values used by the local dev seed.
BASE="${API_BASE_URL:-http://localhost:3001/api/v1}"
EMAIL="${ADMIN_EMAIL:-admin@triline.co}"
PASSWORD="${ADMIN_PASSWORD:-Password#123}"

RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOK=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null)

if [ -z "$TOK" ]; then
  echo "Login failed. Response was:"
  echo "$RESP"
  exit 1
fi

echo "TOKEN_PREFIX=${TOK:0:20}"
echo "=== users ==="
curl -s "$BASE/users?page=1&pageSize=5" -H "Authorization: Bearer $TOK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('meta',{}), indent=2))"
echo "=== maintenance ==="
curl -s "$BASE/maintenance-requests?page=1&pageSize=5" -H "Authorization: Bearer $TOK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('meta',{}), indent=2))"
echo "=== alerts ==="
curl -s "$BASE/maintenance-requests/alerts?page=1&pageSize=5" -H "Authorization: Bearer $TOK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('meta',{}), indent=2))"
echo "=== audit ==="
curl -s "$BASE/audit-log?page=1&pageSize=5" -H "Authorization: Bearer $TOK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('meta',{}), indent=2))"
