#!/bin/bash

set -e

docker start ecommerce_postgres

(cd server && npm run dev) &
SERVER_PID=$!

(cd client && npm run dev) &
CLIENT_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  kill "$CLIENT_PID" 2>/dev/null || true
}
trap cleanup EXIT

wait "$SERVER_PID" "$CLIENT_PID"
