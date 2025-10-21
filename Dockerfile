# Use Python 3.9
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies + patchelf for patching binaries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    gcc \
    g++ \
    patchelf \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# CRITICAL FIX: Clear executable stack flag from onnxruntime binaries
# Railway blocks executable stacks, patchelf clears the PT_GNU_STACK flag
RUN find /usr/local/lib/python3.9/site-packages/onnxruntime -name "*.so" -exec patchelf --clear-execstack {} \; 2>/dev/null || true

# Copy application code
COPY . .

# Download YuNet face detection model
RUN mkdir -p models && \
    wget -O models/yunet.onnx https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx

# Expose port (Railway will set $PORT)
EXPOSE 8000

# Start command
CMD python -m uvicorn api.api:app --host 0.0.0.0 --port ${PORT:-8000}

