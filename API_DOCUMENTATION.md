# KYC Flow API Documentation

Complete API reference for the KYC Verification Service.

**Base URL**: `http://localhost:8000` (local) or `https://your-ml-backend.railway.app` (production)

**API Version**: `v1`

**Content Type**: `application/json` (except where multipart/form-data is specified)

---

## Table of Contents

- [Authentication](#authentication)
- [Health Check](#health-check)
- [KYC Verification](#kyc-verification)
- [OCR Extraction](#ocr-extraction)
- [Liveness Detection](#liveness-detection)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Authentication

Currently, the API does not require authentication. For production deployments, consider implementing API key authentication.

**Future**: API key authentication via header:
```
X-API-Key: your-api-key-here
```

---

## Health Check

### GET `/api/v1/health`

Check the health status of the service and verify that all ML models are loaded.

**Request:**
```http
GET /api/v1/health HTTP/1.1
Host: localhost:8000
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "models": {
    "face_detector": {
      "loaded": true,
      "name": "yunet",
      "error": null
    },
    "face_matcher": {
      "loaded": true,
      "name": "insightface",
      "error": null
    },
    "ocr_extractor": {
      "loaded": true,
      "name": "paddleocr",
      "error": null
    },
    "liveness_detector": {
      "loaded": true,
      "name": "mediapipe+haar",
      "error": null
    }
  },
  "timestamp": "2024-11-14T12:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Service is healthy
- `503 Service Unavailable` - Service is degraded (some models not loaded)

**cURL Example:**
```bash
curl http://localhost:8000/api/v1/health
```

---

## KYC Verification

### POST `/api/v1/kyc/verify`

Complete KYC verification including face detection, face matching, and OCR extraction.

**Request:**
```http
POST /api/v1/kyc/verify HTTP/1.1
Host: localhost:8000
Content-Type: multipart/form-data

id_document: [binary file]
selfie_image: [binary file]
```

**Form Fields:**
- `id_document` (required): ID card or passport image file (JPG, PNG, or PDF)
- `selfie_image` (required): Selfie photo image file (JPG or PNG)

**Response:**
```json
{
  "verification_status": "approved",
  "confidence_score": 0.89,
  "face_match_score": 0.87,
  "ocr_data": {
    "document_type": "passport",
    "confidence": 0.92,
    "extracted_text": "Full extracted text from document...",
    "fields": {
      "full_name": "John Doe",
      "date_of_birth": "01/01/1990",
      "document_number": "ABC123456",
      "nationality": "Switzerland",
      "issue_date": "01/01/2020",
      "expiry_date": "01/01/2030",
      "place_of_birth": "Zurich",
      "address": "123 Main St, Zurich",
      "gender": "M"
    }
  },
  "processing_time_ms": 2500,
  "timestamp": "2024-11-14T12:00:00Z",
  "face_verification_details": {
    "verified": true,
    "confidence": 0.87,
    "similarity_metrics": {
      "cosine_similarity": 0.85,
      "euclidean_distance": 0.42
    },
    "threshold_used": 0.30,
    "message": "Faces match (85.0% similarity)"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `verification_status` | string | `approved`, `rejected`, `pending`, or `error` |
| `confidence_score` | float | Overall confidence (0-1), weighted: 60% face + 40% OCR |
| `face_match_score` | float | Face matching confidence (0-1) |
| `ocr_data` | object | OCR extraction results (see OCRData schema) |
| `processing_time_ms` | integer | Total processing time in milliseconds |
| `timestamp` | string | ISO 8601 timestamp |
| `face_verification_details` | object | Detailed face matching metrics |

**Status Codes:**
- `200 OK` - Verification completed successfully
- `400 Bad Request` - Invalid request (no face detected, invalid file format)
- `503 Service Unavailable` - Service not ready (models still loading)

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/kyc/verify \
  -F "id_document=@id_front.jpg" \
  -F "selfie_image=@selfie.jpg"
```

**Python Example:**
```python
import requests

files = {
    'id_document': open('id_front.jpg', 'rb'),
    'selfie_image': open('selfie.jpg', 'rb')
}

response = requests.post(
    'http://localhost:8000/api/v1/kyc/verify',
    files=files
)

result = response.json()
print(f"Status: {result['verification_status']}")
print(f"Confidence: {result['confidence_score']}")
```

**JavaScript Example:**
```javascript
const formData = new FormData();
formData.append('id_document', idFile);
formData.append('selfie_image', selfieFile);

const response = await fetch('http://localhost:8000/api/v1/kyc/verify', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Status:', result.verification_status);
console.log('Confidence:', result.confidence_score);
```

---

## OCR Extraction

### POST `/api/v1/ocr/extract`

Extract text from a document image without face verification.

**Request:**
```http
POST /api/v1/ocr/extract HTTP/1.1
Host: localhost:8000
Content-Type: multipart/form-data

document: [binary file]
```

**Form Fields:**
- `document` (required): Document image file (JPG, PNG, or PDF)

**Response:**
```json
{
  "ocr_data": {
    "document_type": "drivers_license",
    "confidence": 0.88,
    "extracted_text": "Full extracted text from document...",
    "fields": {
      "full_name": "Jane Smith",
      "date_of_birth": "15/03/1985",
      "document_number": "DL123456",
      "nationality": "German",
      "issue_date": "01/01/2020",
      "expiry_date": "01/01/2030",
      "place_of_birth": "Berlin",
      "address": "456 Oak Ave, Berlin",
      "gender": "F"
    }
  },
  "processing_time_ms": 1800,
  "timestamp": "2024-11-14T12:00:00Z"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `ocr_data` | object | OCR extraction results |
| `ocr_data.document_type` | string | Detected document type (`passport`, `drivers_license`, `national_id`, etc.) |
| `ocr_data.confidence` | float | Overall OCR confidence (0-1) |
| `ocr_data.extracted_text` | string | Full raw text extracted from document |
| `ocr_data.fields` | object | Structured extracted fields (all optional) |
| `processing_time_ms` | integer | Processing time in milliseconds |

**Status Codes:**
- `200 OK` - OCR extraction completed successfully
- `400 Bad Request` - Invalid file format
- `503 Service Unavailable` - OCR service not ready

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/ocr/extract \
  -F "document=@id_document.jpg"
```

---

## Liveness Detection

### GET `/api/v1/liveness/challenge`

Generate a new liveness challenge. Returns 2 random challenges that the user must complete in a single video.

**Request:**
```http
GET /api/v1/liveness/challenge HTTP/1.1
Host: localhost:8000
```

**Response:**
```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "multi_challenge": true,
  "challenge_types": ["blink", "turn_left"],
  "questions": ["blink eyes", "turn face left"],
  "instructions": [
    "Blink your eyes once",
    "Turn your face to the left"
  ],
  "timestamp": 1697022600.0,
  "expires_at": 1697022720.0,
  "nonce": "a1b2c3d4e5f6",
  "signature": "abc123..."
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `challenge_id` | string | Unique challenge identifier (UUID) |
| `multi_challenge` | boolean | Whether this is a multi-challenge session |
| `challenge_types` | array | List of challenge types: `blink`, `turn_left`, `turn_right` |
| `instructions` | array | User-friendly instructions for each challenge |
| `timestamp` | float | Challenge creation timestamp (Unix epoch) |
| `expires_at` | float | Challenge expiration timestamp (Unix epoch) |
| `nonce` | string | Nonce for replay protection |
| `signature` | string | HMAC signature for challenge integrity |

**Status Codes:**
- `200 OK` - Challenge generated successfully
- `500 Internal Server Error` - Challenge generation failed

**cURL Example:**
```bash
curl http://localhost:8000/api/v1/liveness/challenge
```

---

### POST `/api/v1/liveness/verify`

Verify a liveness challenge with captured video frames.

**Request:**
```http
POST /api/v1/liveness/verify HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "frames": [
    "data:image/jpeg;base64,/9j/4AAQ...",
    "data:image/jpeg;base64,/9j/4AAQ...",
    ...
  ]
}
```

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `challenge_id` | string | Challenge ID from `/liveness/challenge` |
| `frames` | array | Array of base64-encoded image frames (minimum 10 frames) |

**Response:**
```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pass",
  "message": "All challenges completed: blink, turn left",
  "detection_results": {
    "blinks": 2,
    "orientation": "left",
    "orientations": ["left", "left", null],
    "face_detected": true
  },
  "processing_time_ms": 1250,
  "timestamp": "2024-11-14T12:00:00Z"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `challenge_id` | string | Challenge ID that was verified |
| `status` | string | `pass`, `fail`, `expired`, or `invalid` |
| `message` | string | Human-readable result message |
| `detection_results` | object | Detailed detection results |
| `detection_results.blinks` | integer | Number of blinks detected |
| `detection_results.orientations` | array | List of detected orientations per frame |
| `detection_results.face_detected` | boolean | Whether face was detected |
| `processing_time_ms` | integer | Processing time in milliseconds |

**Status Codes:**
- `200 OK` - Verification completed
- `400 Bad Request` - Invalid request (no frames, not enough frames, invalid challenge)
- `503 Service Unavailable` - Liveness detector not available

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/v1/liveness/verify \
  -H "Content-Type: application/json" \
  -d '{
    "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
    "frames": ["data:image/jpeg;base64,..."]
  }'
```

**JavaScript Example:**
```javascript
const frames = []; // Array of base64-encoded frames
for (let i = 0; i < videoFrames.length; i++) {
  frames.push(canvas.toDataURL('image/jpeg', 0.7));
}

const response = await fetch('http://localhost:8000/api/v1/liveness/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    challenge_id: challengeId,
    frames: frames
  })
});

const result = await response.json();
console.log('Status:', result.status);
console.log('Message:', result.message);
```

---

### POST `/api/v1/liveness/detect`

Perform batch liveness detection without challenge. Useful for continuous detection or testing.

**Request:**
```http
POST /api/v1/liveness/detect HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "frames": [
    "data:image/jpeg;base64,/9j/4AAQ...",
    "data:image/jpeg;base64,/9j/4AAQ...",
    ...
  ],
  "initial_blink_count": 0
}
```

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `frames` | array | Array of base64-encoded image frames |
| `initial_blink_count` | integer | Initial blink count for tracking (default: 0) |

**Response:**
```json
{
  "total_blinks": 2,
  "final_blink_count": 2,
  "orientations": [null, null, "left", "left", null],
  "face_detection_ratio": 0.85,
  "results": [],
  "frame_count": 30,
  "processing_time_ms": 1200,
  "timestamp": "2024-11-14T12:00:00Z"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `total_blinks` | integer | Total new blinks detected in batch |
| `final_blink_count` | integer | Final cumulative blink count |
| `orientations` | array | Detected orientations per frame (`left`, `right`, or `null`) |
| `face_detection_ratio` | float | Ratio of frames with face detected (0-1) |
| `frame_count` | integer | Number of frames processed |
| `processing_time_ms` | integer | Processing time in milliseconds |

**Status Codes:**
- `200 OK` - Detection completed successfully
- `400 Bad Request` - Invalid request (no frames)
- `503 Service Unavailable` - Liveness detector not available

---

## Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "detail": "Error message describing what went wrong",
  "status_code": 400,
  "timestamp": "2024-11-14T12:00:00Z"
}
```

### Common Error Codes

| Status Code | Description | Common Causes |
|------------|-------------|---------------|
| `400 Bad Request` | Invalid request | Missing required fields, invalid file format, no face detected |
| `404 Not Found` | Resource not found | Invalid endpoint |
| `500 Internal Server Error` | Server error | ML model error, processing failure |
| `503 Service Unavailable` | Service not ready | Models still loading, service starting up |

### Example Error Responses

**No Face Detected:**
```json
{
  "detail": "No face detected in ID document",
  "status_code": 400
}
```

**Service Not Ready:**
```json
{
  "detail": "Service not ready. Models still loading.",
  "status_code": 503
}
```

**Invalid Challenge:**
```json
{
  "detail": "Challenge not found or expired. Please generate a new challenge.",
  "status_code": 400
}
```

---

## Rate Limiting

Currently, rate limiting is disabled by default. For production deployments, configure rate limiting in `configs/defaults.yaml`:

```yaml
api:
  rate_limit_enabled: true
  rate_limit_per_minute: 60
```

When enabled, rate limit headers are included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1697022660
```

**Status Code**: `429 Too Many Requests` when rate limit is exceeded.

---

## Data Models

### VerificationStatus Enum

```typescript
enum VerificationStatus {
  APPROVED = "approved"
  REJECTED = "rejected"
  PENDING = "pending"
  ERROR = "error"
}
```

### ChallengeStatus Enum

```typescript
enum ChallengeStatus {
  PASS = "pass"
  FAIL = "fail"
  PENDING = "pending"
  EXPIRED = "expired"
  INVALID = "invalid"
}
```

### OCRFields

All fields are optional and may be `null` if not detected:

```typescript
interface OCRFields {
  full_name?: string
  date_of_birth?: string
  document_number?: string
  nationality?: string
  issue_date?: string
  expiry_date?: string
  place_of_birth?: string
  address?: string
  gender?: "M" | "F" | null
}
```

---

## Interactive API Documentation

FastAPI provides interactive API documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

These interfaces allow you to:
- Browse all available endpoints
- View request/response schemas
- Test endpoints directly from the browser
- Download OpenAPI specification

---

## Best Practices

### 1. Image Quality
- Use high-resolution images (minimum 640x480)
- Ensure good lighting
- Avoid blurry or distorted images
- Face should be clearly visible and frontal

### 2. File Formats
- Supported: JPG, JPEG, PNG, PDF
- Maximum file size: 10MB (configurable)
- Recommended: JPG or PNG for best performance

### 3. Error Handling
- Always check response status codes
- Handle `503 Service Unavailable` with retry logic
- Validate file formats before upload
- Check for face detection before verification

### 4. Performance
- Use async/await for concurrent requests
- Implement request timeouts (recommended: 30 seconds)
- Cache challenge IDs for liveness detection
- Batch operations when possible

### 5. Security
- Use HTTPS in production
- Validate and sanitize all inputs
- Implement API key authentication
- Monitor for suspicious activity

---

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review health check endpoint
- Open an issue on GitHub
- Consult troubleshooting section in README.md

---

**Last Updated**: November 2024
**API Version**: 1.0.0

