# Use nginx to serve static files
FROM nginx:alpine

# Copy static files to nginx html directory
COPY index.html /usr/share/nginx/html/
COPY ballerine-sdk.umd.js /usr/share/nginx/html/
COPY *.svg /usr/share/nginx/html/

# Copy start script that configures nginx with Railway's PORT
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose port (Railway will inject PORT env var)
EXPOSE ${PORT:-80}

# Start nginx with dynamic port configuration
CMD ["/start.sh"]

