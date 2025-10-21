#!/bin/sh
# Use PORT environment variable from Railway (defaults to 80 if not set)
PORT=${PORT:-80}

# Create nginx config that listens on the Railway PORT
cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen $PORT;
    server_name _;
    
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF

# Start nginx
exec nginx -g 'daemon off;'

