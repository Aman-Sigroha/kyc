FROM nginx:alpine

# Copy frontend files
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

# Copy liveness files
COPY liveness.html /usr/share/nginx/html/
COPY liveness.js /usr/share/nginx/html/
COPY liveness.css /usr/share/nginx/html/

# Create nginx config template for SPA routing
# Railway sets PORT environment variable, we need to use it
# First create the templates directory
RUN mkdir -p /etc/nginx/templates && \
    echo 'server {' > /etc/nginx/templates/default.conf.template && \
    echo '    listen ${PORT} default_server;' >> /etc/nginx/templates/default.conf.template && \
    echo '    listen [::]:${PORT} default_server;' >> /etc/nginx/templates/default.conf.template && \
    echo '    server_name _;' >> /etc/nginx/templates/default.conf.template && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/templates/default.conf.template && \
    echo '    index index.html;' >> /etc/nginx/templates/default.conf.template && \
    echo '    location / {' >> /etc/nginx/templates/default.conf.template && \
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '    location /health {' >> /etc/nginx/templates/default.conf.template && \
    echo '        return 200 "OK";' >> /etc/nginx/templates/default.conf.template && \
    echo '        add_header Content-Type text/plain;' >> /etc/nginx/templates/default.conf.template && \
    echo '    }' >> /etc/nginx/templates/default.conf.template && \
    echo '}' >> /etc/nginx/templates/default.conf.template

# Expose port (Railway will set PORT env var dynamically)
EXPOSE 80

# Nginx will automatically process templates in /etc/nginx/templates/
# and output to /etc/nginx/conf.d/ when container starts

