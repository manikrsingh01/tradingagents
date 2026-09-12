#!/usr/bin/env bash
# Tunnel OmniRoute port 20128 from Hetzner VPS to localhost

VPS_HOST="${VPS_HOST:-root@2.28.118.15}"
PORT=20128

echo "Checking if OmniRoute tunnel is already running on port $PORT..."
if lsof -i :$PORT >/dev/null 2>&1; then
    echo "OmniRoute tunnel is already running on port $PORT."
    exit 0
fi

echo "Opening SSH background tunnel to $VPS_HOST for port $PORT..."
ssh -f -N -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=no -L $PORT:127.0.0.1:$PORT "$VPS_HOST"

if [ $? -eq 0 ]; then
    echo "Successfully connected! OmniRoute gateway is now available locally at http://127.0.0.1:$PORT/v1"
else
    echo "Failed to establish tunnel to $VPS_HOST."
    exit 1
fi
