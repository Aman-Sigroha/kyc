# KYC API - Complete Request/Response Examples

## 📍 Main Endpoint: KYC Verification

### **Endpoint Details**

```
POST /api/v1/kyc/verify
```

**Base URLs:**
- **Local Development**: `http://localhost:8000`
- **Via Proxy (Local)**: `http://localhost:3001`
- **Production (Railway)**: `https://kycflow-production.up.railway.app`
- **Production Proxy**: `https://kyc-proxy-production.up.railway.app`

---

## 📤 REQUEST

### **Method**: `POST`

### **Content-Type**: `multipart/form-data`

### **Required Fields**:

| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `id_document` | File | ID card/passport/driver's license image (JPG/PNG) | ✅ Yes |
| `selfie_image` | File | Selfie photo (JPG/PNG) | ✅ Yes |

### **Optional Fields**:

| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `id_document_back` | File | Back side of ID document (if applicable) | ❌ No |

---

## 📥 RESPONSE

### **Success Response (HTTP 200)**

#### **Response Structure:**

```json
{
  "verification_status": "approved" | "rejected" | "pending" | "error",
  "confidence_score": 0.89,
  "face_match_score": 0.87,
  "ocr_data": {
    "document_type": "drivers_license",
    "confidence": 0.92,
    "extracted_text": "Full raw text extracted from document...",
    "fields": {
      "full_name": "AMAN SIGROHA",
      "date_of_birth": "10.02.2003",
      "document_number": "DL1 20220166923",
      "nationality": "Indian",
      "issue_date": "15.03.2022",
      "expiry_date": "14.03.2042",
      "place_of_birth": null,
      "address": "House NO-28, Street Name, City, State",
      "gender": "M"
    }
  },
  "processing_time_ms": 2500,
  "timestamp": "2024-12-15T10:30:00.123456Z",
  "face_verification_details": {
    "verified": true,
    "confidence": 0.87,
    "similarity_metrics": {
      "cosine_similarity": 0.85,
      "euclidean_distance": 0.42
    },
    "threshold_used": 0.15,
    "message": "Faces match (85.0% similarity)"
  }
}
```

---

## 📋 FIELD DESCRIPTIONS

### **Top-Level Fields:**

| Field | Type | Description | Always Present |
|-------|------|-------------|----------------|
| `verification_status` | string | Overall status: `approved`, `rejected`, `pending`, `error` | ✅ Yes |
| `confidence_score` | float | Overall confidence (0-1): 60% face + 40% OCR | ✅ Yes |
| `face_match_score` | float | Face matching confidence (0-1) | ✅ Yes |
| `ocr_data` | object | OCR extraction results | ✅ Yes |
| `processing_time_ms` | integer | Total processing time in milliseconds | ✅ Yes |
| `timestamp` | string | ISO 8601 timestamp | ✅ Yes |
| `face_verification_details` | object | Detailed face matching metrics | ✅ Yes |

### **OCR Data Fields:**

| Field | Type | Description | Always Present |
|-------|------|-------------|----------------|
| `document_type` | string | Type: `passport`, `drivers_license`, `national_id`, `id_card`, `pan_card`, etc. | ✅ Yes |
| `confidence` | float | OCR confidence score (0-1) | ✅ Yes |
| `extracted_text` | string | Full raw text extracted from document | ✅ Yes |
| `fields` | object | Structured extracted fields | ✅ Yes |

### **OCR Fields (fields object):**

| Field | Type | Description | Always Present |
|-------|------|-------------|----------------|
| `full_name` | string \| null | Person's full name | ⚠️ If detected |
| `date_of_birth` | string \| null | Date of birth (format: DD.MM.YYYY) | ⚠️ If detected |
| `document_number` | string \| null | ID/License/Passport number | ⚠️ If detected |
| `nationality` | string \| null | Nationality/Country | ⚠️ If detected |
| `issue_date` | string \| null | Document issue date (format: DD.MM.YYYY) | ⚠️ If detected |
| `expiry_date` | string \| null | Document expiry date (format: DD.MM.YYYY) | ⚠️ If detected |
| `place_of_birth` | string \| null | Place/City of birth | ⚠️ If detected |
| `address` | string \| null | Full address | ⚠️ If detected |
| `gender` | string \| null | Gender: `M` or `F` | ⚠️ If detected |

**Note**: All `fields` are optional. If a field cannot be extracted, it will be `null`.

---

## 🔍 EXAMPLE 1: Indian Driving License

### **Request:**

```bash
curl -X POST http://localhost:8000/api/v1/kyc/verify \
  -F "id_document=@indian_dl_front.jpg" \
  -F "selfie_image=@selfie.jpg"
```

### **Response:**

```json
{
  "verification_status": "approved",
  "confidence_score": 0.89,
  "face_match_score": 0.87,
  "ocr_data": {
    "document_type": "drivers_license",
    "confidence": 0.92,
    "extracted_text": "TRANSPORT DEPARTMENT | DRIVING LICENCE | Name AMAN SIGROHA | Date of Birth 10-02-2003 | DL1 20220166923 | Address House NO-28, Street, City | Valid Till 14-03-2042",
    "fields": {
      "full_name": "AMAN SIGROHA",
      "date_of_birth": "10.02.2003",
      "document_number": "DL1 20220166923",
      "nationality": "Indian",
      "issue_date": "15.03.2022",
      "expiry_date": "14.03.2042",
      "place_of_birth": null,
      "address": "House NO-28, Street Name, City, State",
      "gender": "M"
    }
  },
  "processing_time_ms": 2456,
  "timestamp": "2024-12-15T10:30:15.123456Z",
  "face_verification_details": {
    "verified": true,
    "confidence": 0.87,
    "similarity_metrics": {
      "cosine_similarity": 0.85,
      "euclidean_distance": 0.42
    },
    "threshold_used": 0.15,
    "message": "Faces match (85.0% similarity)"
  }
}
```

---

## 🔍 EXAMPLE 2: Swiss Passport

### **Request:**

```bash
curl -X POST http://localhost:8000/api/v1/kyc/verify \
  -F "id_document=@swiss_passport.jpg" \
  -F "selfie_image=@selfie.jpg"
```

### **Response:**

```json
{
  "verification_status": "approved",
  "confidence_score": 0.91,
  "face_match_score": 0.89,
  "ocr_data": {
    "document_type": "passport",
    "confidence": 0.95,
    "extracted_text": "SCHWEIZ SUISSE SVIZZERA SVIZRA | PASSPORT PASSEPORT | Schweizer Sample | 01.01.1990 | P<CHESAMPL<<SCHWEIZER<<<<<<<<<<<<<<<<<<<<<<<< | C012345678CHE9001011M2501017<<<<<<<<<<<<<<04",
    "fields": {
      "full_name": "Schweizer Sample",
      "date_of_birth": "01.01.1990",
      "document_number": "C012345678",
      "nationality": "Switzerland",
      "issue_date": "01.01.2020",
      "expiry_date": "01.01.2025",
      "place_of_birth": null,
      "address": null,
      "gender": "M"
    }
  },
  "processing_time_ms": 2789,
  "timestamp": "2024-12-15T10:32:45.987654Z",
  "face_verification_details": {
    "verified": true,
    "confidence": 0.89,
    "similarity_metrics": {
      "cosine_similarity": 0.87,
      "euclidean_distance": 0.38
    },
    "threshold_used": 0.15,
    "message": "Faces match (87.0% similarity)"
  }
}
```

---

## 🔍 EXAMPLE 3: Indian PAN Card

### **Request:**

```bash
curl -X POST http://localhost:8000/api/v1/kyc/verify \
  -F "id_document=@pan_card.jpg" \
  -F "selfie_image=@selfie.jpg"
```

### **Response:**

```json
{
  "verification_status": "approved",
  "confidence_score": 0.86,
  "face_match_score": 0.84,
  "ocr_data": {
    "document_type": "pan_card",
    "confidence": 0.88,
    "extracted_text": "INCOME TAX DEPARTMENT | GOVT OF INDIA | Permanent Account Number | Name JOHN DOE | Father's Name ROBERT DOE | Date of Birth 15/06/1985 | ABCDE1234F",
    "fields": {
      "full_name": "JOHN DOE",
      "date_of_birth": "15.06.1985",
      "document_number": "ABCDE1234F",
      "nationality": "Indian",
      "issue_date": null,
      "expiry_date": null,
      "place_of_birth": null,
      "address": null,
      "gender": null
    }
  },
  "processing_time_ms": 2123,
  "timestamp": "2024-12-15T10:35:20.456789Z",
  "face_verification_details": {
    "verified": true,
    "confidence": 0.84,
    "similarity_metrics": {
      "cosine_similarity": 0.82,
      "euclidean_distance": 0.45
    },
    "threshold_used": 0.15,
    "message": "Faces match (82.0% similarity)"
  }
}
```

---

## ❌ ERROR RESPONSES

### **Error 1: No Face Detected in ID**

**HTTP Status**: `400 Bad Request`

```json
{
  "detail": "No face detected in ID document"
}
```

### **Error 2: No Face Detected in Selfie**

**HTTP Status**: `400 Bad Request`

```json
{
  "detail": "No face detected in selfie image"
}
```

### **Error 3: Face Match Failed (Rejected)**

**HTTP Status**: `200 OK` (status in body is "rejected")

```json
{
  "verification_status": "rejected",
  "confidence_score": 0.25,
  "face_match_score": 0.12,
  "ocr_data": {
    "document_type": "drivers_license",
    "confidence": 0.88,
    "extracted_text": "...",
    "fields": {
      "full_name": "JOHN DOE",
      "date_of_birth": "01.01.1990",
      "document_number": "DL123456",
      "nationality": "Indian",
      "issue_date": null,
      "expiry_date": null,
      "place_of_birth": null,
      "address": null,
      "gender": "M"
    }
  },
  "processing_time_ms": 2300,
  "timestamp": "2024-12-15T10:40:00.123456Z",
  "face_verification_details": {
    "verified": false,
    "confidence": 0.12,
    "similarity_metrics": {
      "cosine_similarity": 0.10,
      "euclidean_distance": 1.25
    },
    "threshold_used": 0.15,
    "message": "Faces do not match (10.0% similarity, threshold: 15.0%)"
  }
}
```

### **Error 4: Service Not Ready**

**HTTP Status**: `503 Service Unavailable`

```json
{
  "detail": "Service not ready. Models still loading."
}
```

### **Error 5: File Too Large**

**HTTP Status**: `413 Request Entity Too Large`

```json
{
  "detail": "File too large. Max size: 10.0MB"
}
```

### **Error 6: Invalid Image Format**

**HTTP Status**: `400 Bad Request`

```json
{
  "detail": "Invalid image format. Supported: JPG, PNG"
}
```

---

## 🧪 TESTING WITH CURL

### **Basic Test:**

```bash
curl -X POST http://localhost:8000/api/v1/kyc/verify \
  -F "id_document=@/path/to/id_card.jpg" \
  -F "selfie_image=@/path/to/selfie.jpg" \
  | jq '.'
```

### **Test via Proxy:**

```bash
curl -X POST http://localhost:3001/api/v1/kyc/verify \
  -F "id_document=@/path/to/id_card.jpg" \
  -F "selfie_image=@/path/to/selfie.jpg" \
  | jq '.'
```

### **Test Production:**

```bash
curl -X POST https://kyc-proxy-production.up.railway.app/api/v1/kyc/verify \
  -F "id_document=@/path/to/id_card.jpg" \
  -F "selfie_image=@/path/to/selfie.jpg" \
  | jq '.'
```

---

## 🐍 TESTING WITH PYTHON

```python
import requests

# Files to upload
files = {
    'id_document': open('id_card.jpg', 'rb'),
    'selfie_image': open('selfie.jpg', 'rb')
}

# Make request
response = requests.post(
    'http://localhost:8000/api/v1/kyc/verify',
    files=files
)

# Parse response
result = response.json()

# Access OCR data
print("Verification Status:", result['verification_status'])
print("Face Match Score:", result['face_match_score'])
print("\nExtracted OCR Fields:")
print("  Name:", result['ocr_data']['fields']['full_name'])
print("  DOB:", result['ocr_data']['fields']['date_of_birth'])
print("  Document Number:", result['ocr_data']['fields']['document_number'])
print("  Nationality:", result['ocr_data']['fields']['nationality'])
print("  Gender:", result['ocr_data']['fields']['gender'])
print("  Address:", result['ocr_data']['fields']['address'])
```

---

## 🌐 TESTING WITH JAVASCRIPT

```javascript
const formData = new FormData();
formData.append('id_document', idFileInput.files[0]);
formData.append('selfie_image', selfieFileInput.files[0]);

const response = await fetch('http://localhost:8000/api/v1/kyc/verify', {
  method: 'POST',
  body: formData
});

const result = await response.json();

// Access OCR data
console.log('Verification Status:', result.verification_status);
console.log('Face Match Score:', result.face_match_score);
console.log('\nExtracted OCR Fields:');
console.log('  Name:', result.ocr_data.fields.full_name);
console.log('  DOB:', result.ocr_data.fields.date_of_birth);
console.log('  Document Number:', result.ocr_data.fields.document_number);
console.log('  Nationality:', result.ocr_data.fields.nationality);
console.log('  Gender:', result.ocr_data.fields.gender);
console.log('  Address:', result.ocr_data.fields.address);
```

---

## 📊 VERIFICATION STATUS LOGIC

The `verification_status` is determined by:

1. **`approved`**: 
   - Face match verified (cosine similarity >= 0.15)
   - AND (face confidence >= 0.35 OR OCR confidence >= 0.5)

2. **`rejected`**: 
   - Face match failed (cosine similarity < 0.15)

3. **`pending`**: 
   - Face match verified BUT both confidences are low
   - Requires manual review

4. **`error`**: 
   - Technical error during processing

---

## 🎯 KEY POINTS

1. ✅ **OCR data is ALWAYS returned** in the response (even if verification is rejected)
2. ✅ **All extracted fields** are in `ocr_data.fields`
3. ✅ **Fields can be `null`** if not detected in the document
4. ✅ **Face matching happens in parallel** with OCR for speed
5. ✅ **Processing time** is typically 2-3 seconds
6. ✅ **Threshold is configurable** (default: 0.15 for face matching)

---

## 📞 Support

For issues or questions:
- Check logs in `logs/` directory
- Review health check: `GET /api/v1/health`
- Test with sample images first
- Ensure good image quality (minimum 640x480, good lighting)

---

**Last Updated**: December 15, 2024

