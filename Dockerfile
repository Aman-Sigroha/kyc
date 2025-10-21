# Use Python 3.9
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies + execstack for patching binaries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    gcc \
    g++ \
    execstack \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# CRITICAL FIX: Remove execstack flag from onnxruntime binaries
# Railway blocks executable stacks, but we can clear the flag post-install
RUN find /usr/local/lib/python3.9/site-packages/onnxruntime -name "*.so" -exec execstack -c {} \; 2>/dev/null || true

# Copy application code
COPY . .

# Expose port (Railway will set $PORT)
EXPOSE 8000

# Start command
CMD python -m uvicorn api.api:app --host 0.0.0.0 --port ${PORT:-8000}

