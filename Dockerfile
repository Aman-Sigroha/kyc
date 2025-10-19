# Use official Python 3.11 slim image (better wheel compatibility than 3.12)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for OpenCV and building C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    gcc \
    g++ \
    make \
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

