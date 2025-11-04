#!/bin/bash
# Simple script to run the custom frontend locally

echo "Starting custom frontend server..."
echo "Access at: http://localhost:3002"
echo "Press Ctrl+C to stop"

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    cd "$(dirname "$0")"
    python3 -m http.server 3002
elif command -v python &> /dev/null; then
    cd "$(dirname "$0")"
    python -m SimpleHTTPServer 3002
else
    echo "Python not found. Please install Python or use another method."
fi

