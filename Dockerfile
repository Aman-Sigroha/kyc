# Use Python 3.9 (older prebuilt wheels might not have execstack requirement)
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies for OpenCV and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Railway will set $PORT)
EXPOSE 8000

# Start command
CMD python -m uvicorn api.api:app --host 0.0.0.0 --port ${PORT:-8000}

