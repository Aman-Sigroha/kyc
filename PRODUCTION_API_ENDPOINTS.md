# Production API Endpoints - KYC Verification System

## 🌐 Base URLs

### Production Proxy (Main API Gateway)
```
https://kyc-proxy-production.up.railway.app
```

### Production ML Backend (Direct - Not Recommended)
```
https://kycflow-production.up.railway.app
```

### Production Frontend
```
https://kyc-custom-frontend-production.up.railway.app
```

---

## ⚠️ Important Notes

1. **Always use the Proxy URL** for API calls from your mobile app
2. The Proxy handles CORS, request transformation, and forwards to the ML backend
3. All endpoints support both `application/json` and `multipart/form-data` where applicable
4. The ML backend URL is for internal use only (proxy → backend communication)

---

## 📋 API Endpoints

### 1. Health Check

#### Proxy Health Check
```http
GET https://kyc-proxy-production.up.railway.app/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-16T10:30:00.000Z",
  "ml_backend": "healthy",
  "endpoints": {
    "verify": "/v2/enduser/verify (POST)",
    "livenessChallenge": "/api/v1/liveness/challenge (GET)",
    "livenessVerify": "/api/v1/liveness/verify (POST)",
    "livenessDetect": "/api/v1/liveness/detect (POST)",
    "ocrExtract": "/api/v1/kyc/ocr (POST)"
  }
}
```

#### ML Backend Health Check
```http
GET https://kyc-proxy-production.up.railway.app/api/v1/health
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
    }
  },
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

---

### 2. KYC Verification (Full Flow)

```http
POST https://kyc-proxy-production.up.railway.app/api/v1/kyc/verify
Content-Type: multipart/form-data
```

**Request Body:**
- `id_document`: File (JPEG/PNG) - Front of ID card/passport/driver's license
- `id_document_back`: File (JPEG/PNG) - Back of ID card (optional)
- `selfie_image`: File (JPEG/PNG) - Selfie photo

**cURL Example:**
```bash
curl -X POST https://kyc-proxy-production.up.railway.app/api/v1/kyc/verify \
  -F "id_document=@id_front.jpg" \
  -F "id_document_back=@id_back.jpg" \
  -F "selfie_image=@selfie.jpg"
```

**Response (Success):**
```json
{
  "status": "approved",
  "message": "Verification successful",
  "face_match_score": 0.85,
  "confidence_score": 0.92,
  "face_verification_details": {
    "faces_detected": 2,
    "confidence": 0.92,
    "threshold_used": 0.30,
    "similarity_metrics": {
      "cosine_similarity": 0.85,
      "euclidean_distance": 0.45
    }
  },
  "ocr_data": {
    "document_type": "passport",
    "full_name": "John Doe",
    "document_number": "AB1234567",
    "date_of_birth": "1990-01-15",
    "expiry_date": "2030-01-15",
    "nationality": "US",
    "gender": "M",
    "address": "123 Main St, City, State"
  },
  "processing_time_ms": 2500,
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

**Response (Rejected - Low Face Match):**
```json
{
  "status": "rejected",
  "message": "Face verification failed: similarity score 0.25 below threshold 0.30",
  "face_match_score": 0.25,
  "face_verification_details": {
    "faces_detected": 2,
    "confidence": 0.25,
    "threshold_used": 0.30,
    "similarity_metrics": {
      "cosine_similarity": 0.25,
      "euclidean_distance": 1.2
    }
  },
  "processing_time_ms": 2200,
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

---

### 3. OCR Extraction Only

```http
POST https://kyc-proxy-production.up.railway.app/api/v1/kyc/ocr
Content-Type: multipart/form-data
```

**Request Body:**
- `document`: File (JPEG/PNG) - ID document image

**cURL Example:**
```bash
curl -X POST https://kyc-proxy-production.up.railway.app/api/v1/kyc/ocr \
  -F "document=@id_card.jpg"
```

**Response:**
```json
{
  "status": "success",
  "ocr_data": {
    "document_type": "drivers_license",
    "full_name": "Jane Smith",
    "document_number": "DL123456789",
    "date_of_birth": "1995-06-20",
    "expiry_date": "2028-06-20",
    "nationality": "Indian",
    "gender": "F",
    "address": "456 Park Avenue, Mumbai, Maharashtra"
  },
  "confidence_score": 0.88,
  "processing_time_ms": 1200,
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

---

### 4. Liveness Detection (Multi-Challenge)

#### 4.1 Generate Liveness Challenge

```http
GET https://kyc-proxy-production.up.railway.app/api/v1/liveness/challenge
```

**Response (Multi-Challenge - 2 Random Tasks):**
```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "multi_challenge": true,
  "challenge_types": ["blink", "turn_left"],
  "questions": [
    "Please blink your eyes once",
    "Please turn your face to the left"
  ],
  "instructions": [
    "Blink your eyes once",
    "Turn your face to the left"
  ],
  "expires_at": 1700135400.0,
  "timestamp": 1700135280.0
}
```

**cURL Example:**
```bash
curl -X GET https://kyc-proxy-production.up.railway.app/api/v1/liveness/challenge
```

---

#### 4.2 Verify Liveness Challenge

```http
POST https://kyc-proxy-production.up.railway.app/api/v1/liveness/verify
Content-Type: application/json
```

**Request Body:**
```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "frames": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
  ]
}
```

**Notes:**
- Send 15-30 frames (captured at 8 FPS over 2-4 seconds)
- Frames should be base64-encoded JPEG images
- User must complete ALL challenges in the single video

**cURL Example:**
```bash
curl -X POST https://kyc-proxy-production.up.railway.app/api/v1/liveness/verify \
  -H "Content-Type: application/json" \
  -d '{
    "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
    "frames": ["data:image/jpeg;base64,...", "data:image/jpeg;base64,..."]
  }'
```

**Response (Success - All Challenges Completed):**
```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pass",
  "message": "All challenges completed: blink, turn left",
  "detection_results": {
    "blinks": 2,
    "orientation": "left",
    "orientations": ["center", "left", "left", "center"],
    "face_detected": true
  },
  "processing_time_ms": 1250,
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

**Response (Failed - Incomplete Challenges):**
```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "fail",
  "message": "Completed: blink. Failed: turn left (not detected)",
  "detection_results": {
    "blinks": 1,
    "orientation": "center",
    "orientations": ["center", "center", "center"],
    "face_detected": true
  },
  "processing_time_ms": 1100,
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

---

#### 4.3 Batch Liveness Detection (No Challenge)

```http
POST https://kyc-proxy-production.up.railway.app/api/v1/liveness/detect
Content-Type: application/json
```

**Request Body:**
```json
{
  "frames": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "liveness_score": 0.92,
  "is_live": true,
  "detection_results": {
    "total_blinks": 3,
    "face_detection_ratio": 0.95,
    "orientations": ["center", "left", "center", "right"],
    "frames_processed": 24
  },
  "processing_time_ms": 1500,
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

---

## 🔐 Authentication

Currently, the API does not require authentication. For production use, consider adding:
- API keys
- JWT tokens
- Rate limiting per client

---

## 📱 Mobile App Integration Guide

### Recommended Flow

1. **Document Capture**
   - Capture front of ID document
   - Capture back of ID document (if applicable)
   - Capture selfie photo

2. **Liveness Check**
   - Call `/api/v1/liveness/challenge` to get 2 random challenges
   - Display instructions to user: "Blink your eyes once AND Turn your face to the left"
   - Record 3-second video (24 frames at 8 FPS)
   - Convert frames to base64 JPEG
   - Call `/api/v1/liveness/verify` with frames

3. **KYC Verification**
   - Call `/api/v1/kyc/verify` with documents and selfie
   - Display results to user

### Example Mobile App Code (React Native)

```javascript
// 1. Generate Liveness Challenge
const generateChallenge = async () => {
  const response = await fetch(
    'https://kyc-proxy-production.up.railway.app/api/v1/liveness/challenge'
  );
  const challenge = await response.json();
  
  // Display: "Blink your eyes once AND Turn your face to the left"
  const instruction = challenge.instructions.join(' AND ');
  return { challenge, instruction };
};

// 2. Verify Liveness
const verifyLiveness = async (challengeId, frames) => {
  const response = await fetch(
    'https://kyc-proxy-production.up.railway.app/api/v1/liveness/verify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: challengeId, frames })
    }
  );
  return await response.json();
};

// 3. Submit KYC Verification
const submitKYC = async (idFront, idBack, selfie) => {
  const formData = new FormData();
  formData.append('id_document', {
    uri: idFront.uri,
    type: 'image/jpeg',
    name: 'id_front.jpg'
  });
  if (idBack) {
    formData.append('id_document_back', {
      uri: idBack.uri,
      type: 'image/jpeg',
      name: 'id_back.jpg'
    });
  }
  formData.append('selfie_image', {
    uri: selfie.uri,
    type: 'image/jpeg',
    name: 'selfie.jpg'
  });

  const response = await fetch(
    'https://kyc-proxy-production.up.railway.app/api/v1/kyc/verify',
    {
      method: 'POST',
      body: formData
    }
  );
  return await response.json();
};
```

---

## 🚨 Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (missing parameters, invalid format)
- `422` - Unprocessable Entity (validation failed)
- `500` - Internal Server Error

### Error Response Format

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common Errors

1. **Missing Files**
```json
{
  "detail": "Missing required file: id_document"
}
```

2. **Invalid Challenge**
```json
{
  "detail": "Invalid or expired challenge ID"
}
```

3. **Face Not Detected**
```json
{
  "status": "rejected",
  "message": "No face detected in selfie image"
}
```

4. **Low Quality Image**
```json
{
  "detail": "Image quality too low for processing"
}
```

---

## 📊 Performance & Limits

### Processing Times (Typical)
- OCR Extraction: 1-2 seconds
- Face Verification: 2-3 seconds
- Liveness Detection: 1-2 seconds

### Recommended Limits
- Image size: Max 10MB per image
- Liveness frames: 15-30 frames (3-4 seconds at 8 FPS)
- Challenge expiration: 120 seconds

### Image Requirements
- Format: JPEG or PNG
- Resolution: Minimum 640x480, Recommended 1280x720
- Face size: Minimum 100x100 pixels in image
- Lighting: Good, even lighting (avoid shadows)

---

## 🔍 Testing the API

### Quick Test with cURL

```bash
# 1. Check if API is healthy
curl https://kyc-proxy-production.up.railway.app/health

# 2. Generate liveness challenge
curl https://kyc-proxy-production.up.railway.app/api/v1/liveness/challenge

# 3. Test OCR (replace with your image)
curl -X POST https://kyc-proxy-production.up.railway.app/api/v1/kyc/ocr \
  -F "document=@test_id.jpg"

# 4. Test full KYC verification
curl -X POST https://kyc-proxy-production.up.railway.app/api/v1/kyc/verify \
  -F "id_document=@id_front.jpg" \
  -F "selfie_image=@selfie.jpg"
```

---

## 📞 Support

For issues or questions:
1. Check logs in Railway dashboard
2. Verify all services are running
3. Test with cURL to isolate issues
4. Check image quality and format

---

## 🔄 API Versioning

Current version: **v1**

All endpoints are prefixed with `/api/v1/` for versioning.

---

## 📝 Changelog

### November 2025
- ✅ Multi-challenge liveness detection (2 random tasks)
- ✅ PaddleOCR integration for improved OCR accuracy
- ✅ Face matching threshold increased to 30% (stricter)
- ✅ Support for Indian Driving License, Swiss Passport
- ✅ Enhanced address extraction for multi-line addresses

---

**Last Updated:** November 16, 2025

