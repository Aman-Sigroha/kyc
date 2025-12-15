# KYC API - Data Flow Visualization

## 📊 Complete Data Flow: What Goes In, What Comes Out

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Frontend/App)                          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ HTTP POST Request
                                 │ Content-Type: multipart/form-data
                                 │
                                 ▼
                    ┌────────────────────────────┐
                    │    REQUEST PAYLOAD         │
                    ├────────────────────────────┤
                    │ • id_document: [JPG/PNG]   │
                    │ • selfie_image: [JPG/PNG]  │
                    └────────────┬───────────────┘
                                 │
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PYTHON ML BACKEND (FastAPI)                           │
│                    POST /api/v1/kyc/verify                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Step 1: Face Detection (YuNet)                                          │
│  ├─ Detect face in ID document ✓                                        │
│  └─ Detect face in selfie ✓                                             │
│                                                                           │
│  Step 2: Parallel Processing                                             │
│  ├─ Face Matching (InsightFace)                                         │
│  │  ├─ Extract embeddings from both faces                               │
│  │  ├─ Calculate cosine similarity                                      │
│  │  └─ Compare with threshold (0.15)                                    │
│  │                                                                        │
│  └─ OCR Extraction (PaddleOCR)                                          │
│     ├─ Extract all text from ID document                                │
│     ├─ Detect document type                                             │
│     ├─ Parse structured fields:                                         │
│     │  ├─ Full Name                                                     │
│     │  ├─ Date of Birth                                                 │
│     │  ├─ Document Number                                               │
│     │  ├─ Nationality                                                   │
│     │  ├─ Gender                                                        │
│     │  ├─ Issue Date                                                    │
│     │  ├─ Expiry Date                                                   │
│     │  ├─ Place of Birth                                                │
│     │  └─ Address                                                       │
│     └─ Calculate OCR confidence                                         │
│                                                                           │
│  Step 3: Verification Logic                                              │
│  ├─ Determine verification status (approved/rejected/pending)           │
│  └─ Calculate overall confidence score                                  │
│                                                                           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ HTTP 200 OK
                                 │ Content-Type: application/json
                                 │
                                 ▼
                    ┌────────────────────────────┐
                    │    RESPONSE PAYLOAD        │
                    │    (JSON)                  │
                    └────────────┬───────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           RESPONSE STRUCTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  {                                                                        │
│    "verification_status": "approved",        ← Overall result           │
│    "confidence_score": 0.89,                 ← Combined confidence      │
│    "face_match_score": 0.87,                 ← Face matching score      │
│                                                                           │
│    "ocr_data": {                             ← ✅ OCR EXTRACTED DATA    │
│      "document_type": "drivers_license",                                │
│      "confidence": 0.92,                                                 │
│      "extracted_text": "Full text...",                                  │
│                                                                           │
│      "fields": {                             ← ✅ STRUCTURED FIELDS     │
│        "full_name": "AMAN SIGROHA",          ← ✅ Name                  │
│        "date_of_birth": "10.02.2003",        ← ✅ DOB                   │
│        "document_number": "DL1 20220166923", ← ✅ Doc Number            │
│        "nationality": "Indian",              ← ✅ Nationality           │
│        "gender": "M",                        ← ✅ Gender                │
│        "issue_date": "15.03.2022",           ← ✅ Issue Date            │
│        "expiry_date": "14.03.2042",          ← ✅ Expiry Date           │
│        "place_of_birth": null,               ← Not detected             │
│        "address": "House NO-28, Street..."   ← ✅ Address               │
│      }                                                                   │
│    },                                                                    │
│                                                                           │
│    "processing_time_ms": 2500,                                           │
│    "timestamp": "2024-12-15T10:30:00Z",                                 │
│                                                                           │
│    "face_verification_details": {                                        │
│      "verified": true,                                                   │
│      "confidence": 0.87,                                                 │
│      "similarity_metrics": {                                             │
│        "cosine_similarity": 0.85,                                        │
│        "euclidean_distance": 0.42                                        │
│      },                                                                  │
│      "threshold_used": 0.15,                                             │
│      "message": "Faces match (85.0% similarity)"                         │
│    }                                                                     │
│  }                                                                        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Points

### ✅ **OCR Data IS Sent in Response**

The OCR extracted data is **ALWAYS** included in the response under:
```json
response.ocr_data.fields
```

### 📋 **Available OCR Fields**

All these fields are extracted and sent (if detected):

| Field | JSON Path | Example Value |
|-------|-----------|---------------|
| Name | `ocr_data.fields.full_name` | `"AMAN SIGROHA"` |
| Date of Birth | `ocr_data.fields.date_of_birth` | `"10.02.2003"` |
| Document Number | `ocr_data.fields.document_number` | `"DL1 20220166923"` |
| Nationality | `ocr_data.fields.nationality` | `"Indian"` |
| Gender | `ocr_data.fields.gender` | `"M"` |
| Issue Date | `ocr_data.fields.issue_date` | `"15.03.2022"` |
| Expiry Date | `ocr_data.fields.expiry_date` | `"14.03.2042"` |
| Place of Birth | `ocr_data.fields.place_of_birth` | `null` (if not found) |
| Address | `ocr_data.fields.address` | `"House NO-28, Street..."` |

---

## 🔍 How to Access OCR Data

### **JavaScript/TypeScript:**

```javascript
const response = await fetch('/api/v1/kyc/verify', {
  method: 'POST',
  body: formData
});

const result = await response.json();

// Access OCR fields
const name = result.ocr_data.fields.full_name;
const dob = result.ocr_data.fields.date_of_birth;
const docNumber = result.ocr_data.fields.document_number;
const nationality = result.ocr_data.fields.nationality;
const gender = result.ocr_data.fields.gender;
const address = result.ocr_data.fields.address;

console.log('Name:', name);
console.log('DOB:', dob);
console.log('Document Number:', docNumber);
```

### **Python:**

```python
response = requests.post('/api/v1/kyc/verify', files=files)
result = response.json()

# Access OCR fields
name = result['ocr_data']['fields']['full_name']
dob = result['ocr_data']['fields']['date_of_birth']
doc_number = result['ocr_data']['fields']['document_number']
nationality = result['ocr_data']['fields']['nationality']
gender = result['ocr_data']['fields']['gender']
address = result['ocr_data']['fields']['address']

print(f"Name: {name}")
print(f"DOB: {dob}")
print(f"Document Number: {doc_number}")
```

### **cURL + jq:**

```bash
curl -X POST http://localhost:8000/api/v1/kyc/verify \
  -F "id_document=@id.jpg" \
  -F "selfie_image=@selfie.jpg" \
  | jq '.ocr_data.fields'
```

Output:
```json
{
  "full_name": "AMAN SIGROHA",
  "date_of_birth": "10.02.2003",
  "document_number": "DL1 20220166923",
  "nationality": "Indian",
  "gender": "M",
  "issue_date": "15.03.2022",
  "expiry_date": "14.03.2042",
  "place_of_birth": null,
  "address": "House NO-28, Street Name, City"
}
```

---

## 📦 Response Size

Typical response size: **2-5 KB** (JSON)

Breakdown:
- Metadata (status, scores, timestamps): ~500 bytes
- Face verification details: ~300 bytes
- OCR data (fields + extracted text): ~1-4 KB

---

## ⚡ Processing Pipeline

```
Upload Images (2 files)
    ↓
Face Detection (~100ms)
    ↓
┌─────────────────┬─────────────────┐
│                 │                 │
Face Matching     OCR Extraction
(~200ms)          (~2000ms)
│                 │
└─────────┬───────┘
          ↓
Verification Logic (~10ms)
          ↓
Build Response (~5ms)
          ↓
Return JSON (2-5 KB)
```

**Total Time**: ~2-3 seconds

---

## 🎨 Frontend Display Example

```html
<div class="kyc-results">
  <h2>Verification Results</h2>
  
  <div class="status">
    Status: <span class="badge">{{ verification_status }}</span>
  </div>
  
  <div class="ocr-data">
    <h3>Extracted Information</h3>
    <table>
      <tr>
        <td>Full Name:</td>
        <td>{{ ocr_data.fields.full_name }}</td>
      </tr>
      <tr>
        <td>Date of Birth:</td>
        <td>{{ ocr_data.fields.date_of_birth }}</td>
      </tr>
      <tr>
        <td>Document Number:</td>
        <td>{{ ocr_data.fields.document_number }}</td>
      </tr>
      <tr>
        <td>Nationality:</td>
        <td>{{ ocr_data.fields.nationality }}</td>
      </tr>
      <tr>
        <td>Gender:</td>
        <td>{{ ocr_data.fields.gender }}</td>
      </tr>
      <tr>
        <td>Address:</td>
        <td>{{ ocr_data.fields.address }}</td>
      </tr>
    </table>
  </div>
</div>
```

---

## 🔒 Data Privacy Note

⚠️ **Important**: The response contains PII (Personally Identifiable Information):
- Full name
- Date of birth
- Document number
- Address

**Best Practices**:
1. ✅ Use HTTPS in production
2. ✅ Don't log full responses
3. ✅ Store securely (encrypted database)
4. ✅ Implement data retention policies
5. ✅ Comply with GDPR/privacy regulations

---

## 📞 Support

If OCR fields are not being extracted:
1. Check image quality (minimum 640x480, good lighting)
2. Ensure document is clearly visible
3. Check logs: `logs/ocr_extractor.log`
4. Review extracted text: `ocr_data.extracted_text`
5. Try different document types

---

**Last Updated**: December 15, 2024

