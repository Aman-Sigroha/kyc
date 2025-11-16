# Production API Endpoints - Quick Reference

## Base URL
```
https://kyc-proxy-production.up.railway.app
```

---

## Endpoints

### 1. Health Check
```http
GET /health
```

---

### 2. KYC Verification
```http
POST /api/v1/kyc/verify
Content-Type: multipart/form-data

Form Data:
- id_document: File (front of ID)
- id_document_back: File (back of ID, optional)
- selfie_image: File (selfie photo)
```

**Response:**
```json
{
  "status": "approved",
  "face_match_score": 0.85,
  "ocr_data": {
    "full_name": "John Doe",
    "document_number": "AB1234567",
    "date_of_birth": "1990-01-15",
    "nationality": "US"
  }
}
```

---

### 3. OCR Only
```http
POST /api/v1/kyc/ocr
Content-Type: multipart/form-data

Form Data:
- document: File (ID document image)
```

---

### 4. Liveness Detection

#### Generate Challenge
```http
GET /api/v1/liveness/challenge
```

**Response:**
```json
{
  "challenge_id": "uuid",
  "multi_challenge": true,
  "instructions": ["Blink your eyes once", "Turn your face to the left"]
}
```

#### Verify Challenge
```http
POST /api/v1/liveness/verify
Content-Type: application/json

{
  "challenge_id": "uuid",
  "frames": ["base64_image1", "base64_image2", ...]
}
```

**Response:**
```json
{
  "status": "pass",
  "message": "All challenges completed: blink, turn left"
}
```

---

## Quick Test

```bash
# Health check
curl https://kyc-proxy-production.up.railway.app/health

# KYC verification
curl -X POST https://kyc-proxy-production.up.railway.app/api/v1/kyc/verify \
  -F "id_document=@id.jpg" \
  -F "selfie_image=@selfie.jpg"

# Liveness challenge
curl https://kyc-proxy-production.up.railway.app/api/v1/liveness/challenge
```

---

## Requirements

- **Image format**: JPEG or PNG
- **Max size**: 10MB per image
- **Face matching threshold**: 30% (strict)
- **Liveness frames**: 15-30 frames at 8 FPS

---

## Status Codes

- `200` - Success
- `400` - Bad Request
- `422` - Validation Failed
- `500` - Server Error

