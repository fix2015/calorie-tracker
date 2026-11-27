#!/bin/bash
# Turns on Calorize's free-tier limits (AI_PAYWALL_ENABLED=true) in the production backend env, then redeploys.
set -euo pipefail
TMP="$(mktemp)"
ssh probooking "sudo cat /opt/calorie-tracker/infra/backend.env" | grep -v '^AI_PAYWALL_ENABLED=' > "$TMP"
echo "AI_PAYWALL_ENABLED=true" >> "$TMP"
export GH_TOKEN="$(gh auth token -u fix2015)"
gh secret set BACKEND_ENV --repo fix2015/calorie-tracker --body "$(base64 -i "$TMP" | tr -d '\n')"
rm -f "$TMP"
gh workflow run deploy.yml --repo fix2015/calorie-tracker
echo "Paywall enabled; deploy started."
