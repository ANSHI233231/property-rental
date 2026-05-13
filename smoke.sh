#!/bin/bash
BASE="http://localhost:3001/api/v1"
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@triline.co","password":"password123!"}')
TOK=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null)
echo "TOKEN_PREFIX=${TOK:0:20}"
echo "=== users ==="
curl -s "$BASE/users?page=1&pageSize=5" -H "Authorization: Bearer $TOK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('meta',{}), indent=2))"
echo "=== maintenance ==="
curl -s "$BASE/maintenance-requests?page=1&pageSize=5" -H "Authorization: Bearer $TOK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('meta',{}), indent=2))"
echo "=== alerts ==="
curl -s "$BASE/maintenance-requests/alerts?page=1&pageSize=5" -H "Authorization: Bearer $TOK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('meta',{}), indent=2))"
echo "=== audit ==="
curl -s "$BASE/audit-log?page=1&pageSize=5" -H "Authorization: Bearer $TOK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('meta',{}), indent=2))"
