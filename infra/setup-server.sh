#!/bin/bash
set -e

NGINX_CONF="/etc/nginx/sites-available/probooking.app"
SNIPPET="/opt/calorie-tracker/infra/nginx-snippet.conf"

echo "=== Calorie Tracker Server Setup ==="

# Check if nginx snippet is already added
if grep -q "Calorie Tracker API" "$NGINX_CONF" 2>/dev/null; then
    echo "Nginx config already contains calorie tracker routes. Skipping."
else
    echo "Adding calorie tracker routes to nginx..."

    # Insert the snippet before the last closing brace of the main server block
    # Backup first
    cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%s)"

    # Read snippet and insert before the last } in the file
    SNIPPET_CONTENT=$(cat "$SNIPPET")
    # Use python for reliable insertion
    python3 -c "
import sys
with open('$NGINX_CONF', 'r') as f:
    content = f.read()
# Find last closing brace
idx = content.rfind('}')
if idx == -1:
    print('ERROR: Could not find closing brace in nginx config')
    sys.exit(1)
snippet = open('$SNIPPET').read()
new_content = content[:idx] + '\n' + snippet + '\n' + content[idx:]
with open('$NGINX_CONF', 'w') as f:
    f.write(new_content)
print('Inserted calorie tracker nginx config')
"
fi

# Test nginx config
echo "Testing nginx config..."
nginx -t

# Reload nginx
echo "Reloading nginx..."
systemctl reload nginx

echo ""
echo "=== Done! ==="
echo "Calorie Tracker will be available at https://probooking.app/calories/"
echo ""
echo "Next steps:"
echo "  1. cd /opt/calorie-tracker/infra"
echo "  2. Copy .env.example to .env and backend.env.example to backend.env"
echo "  3. Edit both files with your secrets"
echo "  4. docker compose -f docker-compose.prod.yml pull"
echo "  5. docker compose -f docker-compose.prod.yml up -d"
