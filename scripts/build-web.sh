#!/usr/bin/env bash
# Builds the website and copies it into backend/public so one server hosts API + site.
set -euo pipefail
cd "$(dirname "$0")/../app"
npm install
rm -rf dist
npx expo export --platform web
rm -rf ../backend/public
cp -R dist ../backend/public
echo "Web build copied to backend/public"
