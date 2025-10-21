#!/bin/sh
# Use PORT environment variable from Railway (defaults to 8080 if not set)
PORT=${PORT:-8080}

echo "====================================="
echo "🚀 Starting nginx on PORT: $PORT"
echo "====================================="

# Remove default nginx config
rm -f /etc/nginx/conf.d/default.conf

# Create nginx config that listens on the Railway PORT
cat > /etc/nginx/nginx.conf <<EOF
worker_processes auto;
error_log /dev/stdout info;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    access_log /dev/stdout;
    sendfile on;
    keepalive_timeout 65;
    gzip on;
    
    server {
        listen $PORT;
        server_name _;
        
        root /usr/share/nginx/html;
        index index.html;
        
        location / {
            try_files \$uri \$uri/ /index.html;
        }
    }
}
EOF

echo "Nginx config created, starting server..."
cat /etc/nginx/nginx.conf

# Start nginx
exec nginx -g 'daemon off;'

