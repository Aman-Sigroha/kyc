# Ballerine Backend Proxy with ML Integration

This Node.js Express server acts as a **proxy** between the Ballerine Web SDK frontend and the Python ML backend. It handles:
- ✅ Request transformation (base64 → multipart/form-data)
- ✅ Verification session management
- ✅ ML backend communication
- ✅ Proper HTTP status codes for approval/rejection

## Architecture

```
Frontend (Ballerine SDK)  →  Node.js Proxy (this)  →  Python ML Backend
    Port 3000                    Port 3001                Port 8000
```

## Prerequisites

1. **Python ML Backend must be running on port 8000**
   ```bash
   cd ../../../../  # Back to project root
   python -m uvicorn api.api:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Node.js installed** (v14+)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

The server will start on **http://localhost:3001**

## API Endpoints

### Ballerine SDK Endpoints
- `POST /v2/enduser/verify` - Start verification & process with ML backend
- `GET /v2/enduser/verify/status/:verificationId` - Get verification status
- `POST /v2/enduser/verify/partial` - Process step data
- `POST /v2/enduser/verify/final` - Finalize verification
- `GET /v2/clients/:clientId/config` - Get client configuration

### Utility Endpoints
- `GET /health` - Proxy health check
- `GET /api/v1/ml/health` - ML backend health check with model status

## ML Backend Integration

The proxy automatically forwards KYC verification requests to the Python ML backend:

**When the frontend submits documents:**
1. Extracts ID document and selfie from request body
2. Converts base64 images to Buffer
3. Creates FormData with images
4. Sends `POST` to `http://localhost:8000/api/v1/kyc/verify`
5. Receives ML verification result:
   - Face matching score
   - OCR extracted data
   - Verification status (approved/rejected)
6. Returns appropriate HTTP status:
   - **200 OK** for `approved` → Frontend shows success
   - **422 Unprocessable Entity** for `rejected` → Frontend shows error

**Example ML Response:**
```json
{
  "verification_status": "approved",
  "confidence_score": 0.66,
  "face_match_score": 0.57,
  "ocr_data": {
    "document_type": "drivers_license",
    "extracted_text": "...",
    "fields": {
      "full_name": "...",
      "date_of_birth": "...",
      "document_number": "..."
    }
  },
  "face_verification_details": {
    "verified": true,
    "confidence": 0.57,
    "similarity_metrics": {
      "cosine_similarity": 0.59,
      "euclidean_distance": 0.91
    },
    "message": "Faces match (58.7% similarity)"
  }
}
```

## Configuration

**Python ML Backend URL** is set at the top of `server.js`:
```javascript
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
```

Override with environment variable:
```bash
PYTHON_BACKEND_URL=http://your-ml-backend:8000 npm start
```

## Testing

### Health Check
```bash
# Check proxy status
curl http://localhost:3001/health

# Check ML backend status (via proxy)
curl http://localhost:3001/api/v1/ml/health
```

### Full KYC Flow
Use the Ballerine Web SDK at http://localhost:3000/ which is configured to use this proxy.

### Direct API Test
```bash
# Start verification with documents
curl -X POST http://localhost:3001/v2/enduser/verify \
  -H "Content-Type: application/json" \
  -d '{
    "endUserInfo": {"id": "test-user-123"},
    "documents": [
      {
        "type": "id_card",
        "base64": "data:image/jpeg;base64,..."
      },
      {
        "type": "selfie",
        "base64": "data:image/jpeg;base64,..."
      }
    ]
  }'

# Check verification status
curl http://localhost:3001/v2/enduser/verify/status/verify_1
```

## Frontend Integration

The Ballerine Web SDK is already configured to use this proxy in:
`../sdks/web-sdk/examples/standalone/index.html`

```javascript
backendConfig: {
  baseUrl: 'http://localhost:3001',
  endpoints: {
    verify: '/v2/enduser/verify',
    status: '/v2/enduser/verify/status',
    submitPartial: '/v2/enduser/verify/partial',
    submitFinal: '/v2/enduser/verify/final',
  },
}
```

## Logging

The server logs all incoming requests with:
- Timestamp
- HTTP method and path
- Headers
- Body preview (first 300 chars)
- ML backend responses

Check console output for debugging.

## Troubleshooting

**Error: EADDRINUSE :::3001**
- Port 3001 is already in use
- Solution: Kill the existing process or use a different port

**ML Backend connection fails**
- Ensure Python backend is running on port 8000
- Check `curl http://localhost:8000/`

**Frontend shows "Success" for rejected verification**
- Check that server returns status 422 for rejected (not 200)
- Verify the status code logic in `server.js` around line 106

## Development

Key files:
- `server.js` - Main server with ML integration
- `package.json` - Dependencies (express, axios, form-data, cors)

To modify ML backend URL or add new endpoints, edit `server.js`.
