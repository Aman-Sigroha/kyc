# KYC API - Quick Start Guide

## 🚀 TL;DR - Get OCR Data in 3 Steps

### **Step 1: Send Request**
```bash
curl -X POST http://localhost:8000/api/v1/kyc/verify \
  -F "id_document=@id_card.jpg" \
  -F "selfie_image=@selfie.jpg"
```

### **Step 2: Get Response**
```json
{
  "verification_status": "approved",
  "ocr_data": {
    "fields": {
      "full_name": "AMAN SIGROHA",
      "date_of_birth": "10.02.2003",
      "document_number": "DL1 20220166923",
      "nationality": "Indian",
      "gender": "M",
      "address": "House NO-28, Street..."
    }
  }
}
```

### **Step 3: Access Data**
```javascript
const name = response.ocr_data.fields.full_name;
const dob = response.ocr_data.fields.date_of_birth;
const docNumber = response.ocr_data.fields.document_number;
```

---

## ✅ What You Asked For

**Question**: "Where is the OCR data (name, age, etc.) sent in the response?"

**Answer**: ✅ **It's ALREADY being sent!**

### **Location in Response:**
```
response
  └─ ocr_data
      └─ fields
          ├─ full_name          ← Name
          ├─ date_of_birth      ← DOB (calculate age from this)
          ├─ document_number    ← ID/License number
          ├─ nationality        ← Country
          ├─ gender             ← M/F
          ├─ issue_date         ← When issued
          ├─ expiry_date        ← When expires
          ├─ place_of_birth     ← Birth place
          └─ address            ← Full address
```

---

## 📋 Complete Field List

| Field | Always Present? | Example Value |
|-------|----------------|---------------|
| `full_name` | ⚠️ If detected | `"AMAN SIGROHA"` |
| `date_of_birth` | ⚠️ If detected | `"10.02.2003"` |
| `document_number` | ⚠️ If detected | `"DL1 20220166923"` |
| `nationality` | ⚠️ If detected | `"Indian"` |
| `gender` | ⚠️ If detected | `"M"` or `"F"` |
| `issue_date` | ⚠️ If detected | `"15.03.2022"` |
| `expiry_date` | ⚠️ If detected | `"14.03.2042"` |
| `place_of_birth` | ⚠️ If detected | `"Mumbai"` |
| `address` | ⚠️ If detected | `"House NO-28, Street..."` |

**Note**: Fields are `null` if not detected in the document.

---

## 🎯 Code Examples

### **JavaScript (Frontend)**

```javascript
// Send request
const formData = new FormData();
formData.append('id_document', idFile);
formData.append('selfie_image', selfieFile);

const response = await fetch('http://localhost:8000/api/v1/kyc/verify', {
  method: 'POST',
  body: formData
});

const result = await response.json();

// Extract OCR data
const ocrFields = result.ocr_data.fields;

console.log('Name:', ocrFields.full_name);
console.log('DOB:', ocrFields.date_of_birth);
console.log('Document Number:', ocrFields.document_number);
console.log('Nationality:', ocrFields.nationality);
console.log('Gender:', ocrFields.gender);
console.log('Address:', ocrFields.address);

// Calculate age from DOB
if (ocrFields.date_of_birth) {
  const [day, month, year] = ocrFields.date_of_birth.split('.');
  const birthDate = new Date(year, month - 1, day);
  const age = Math.floor((new Date() - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
  console.log('Age:', age);
}
```

### **Python (Backend)**

```python
import requests
from datetime import datetime

# Send request
files = {
    'id_document': open('id_card.jpg', 'rb'),
    'selfie_image': open('selfie.jpg', 'rb')
}

response = requests.post('http://localhost:8000/api/v1/kyc/verify', files=files)
result = response.json()

# Extract OCR data
ocr_fields = result['ocr_data']['fields']

print('Name:', ocr_fields.get('full_name'))
print('DOB:', ocr_fields.get('date_of_birth'))
print('Document Number:', ocr_fields.get('document_number'))
print('Nationality:', ocr_fields.get('nationality'))
print('Gender:', ocr_fields.get('gender'))
print('Address:', ocr_fields.get('address'))

# Calculate age from DOB
if ocr_fields.get('date_of_birth'):
    day, month, year = ocr_fields['date_of_birth'].split('.')
    birth_date = datetime(int(year), int(month), int(day))
    age = (datetime.now() - birth_date).days // 365
    print('Age:', age)
```

### **React Component**

```jsx
function KYCResults({ verificationResult }) {
  const { ocr_data } = verificationResult;
  const fields = ocr_data.fields;
  
  // Calculate age
  const calculateAge = (dob) => {
    if (!dob) return null;
    const [day, month, year] = dob.split('.');
    const birthDate = new Date(year, month - 1, day);
    return Math.floor((new Date() - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
  };
  
  return (
    <div className="kyc-results">
      <h2>Extracted Information</h2>
      
      <div className="field">
        <label>Full Name:</label>
        <span>{fields.full_name || 'Not detected'}</span>
      </div>
      
      <div className="field">
        <label>Date of Birth:</label>
        <span>{fields.date_of_birth || 'Not detected'}</span>
      </div>
      
      <div className="field">
        <label>Age:</label>
        <span>{calculateAge(fields.date_of_birth) || 'N/A'} years</span>
      </div>
      
      <div className="field">
        <label>Document Number:</label>
        <span>{fields.document_number || 'Not detected'}</span>
      </div>
      
      <div className="field">
        <label>Nationality:</label>
        <span>{fields.nationality || 'Not detected'}</span>
      </div>
      
      <div className="field">
        <label>Gender:</label>
        <span>{fields.gender || 'Not detected'}</span>
      </div>
      
      <div className="field">
        <label>Address:</label>
        <span>{fields.address || 'Not detected'}</span>
      </div>
    </div>
  );
}
```

---

## 🧪 Test It Now

### **Option 1: Using cURL**

```bash
# Replace with your actual image paths
curl -X POST http://localhost:8000/api/v1/kyc/verify \
  -F "id_document=@/path/to/id_card.jpg" \
  -F "selfie_image=@/path/to/selfie.jpg" \
  | jq '.ocr_data.fields'
```

### **Option 2: Using Python Script**

```bash
# Use the provided test script
python test_api_example.py id_card.jpg selfie.jpg
```

### **Option 3: Using Postman**

1. Create new POST request to `http://localhost:8000/api/v1/kyc/verify`
2. Go to "Body" → "form-data"
3. Add key `id_document` (type: File), select image
4. Add key `selfie_image` (type: File), select image
5. Click "Send"
6. View response → `ocr_data.fields`

---

## 📊 Response Structure (Simplified)

```json
{
  "verification_status": "approved",
  "confidence_score": 0.89,
  "face_match_score": 0.87,
  
  "ocr_data": {
    "document_type": "drivers_license",
    "confidence": 0.92,
    
    "fields": {
      "full_name": "AMAN SIGROHA",
      "date_of_birth": "10.02.2003",
      "document_number": "DL1 20220166923",
      "nationality": "Indian",
      "gender": "M",
      "issue_date": "15.03.2022",
      "expiry_date": "14.03.2042",
      "place_of_birth": null,
      "address": "House NO-28, Street..."
    }
  }
}
```

---

## 🔍 Where to Find It in Code

### **Backend (Python):**

**File**: `api/api.py` (lines 384-412)

```python
# OCR data is populated here
ocr_fields = OCRFields(
    full_name=ocr_result.full_name,
    date_of_birth=ocr_result.date_of_birth,
    document_number=ocr_result.document_number,
    nationality=ocr_result.nationality,
    issue_date=ocr_result.issue_date,
    expiry_date=ocr_result.expiry_date,
    place_of_birth=ocr_result.place_of_birth,
    address=ocr_result.address,
    gender=ocr_result.gender
)

ocr_data = OCRData(
    document_type=ocr_result.document_type,
    confidence=ocr_result.confidence,
    extracted_text=ocr_result.extracted_text,
    fields=ocr_fields  # ← OCR fields here
)

return KYCVerificationResponse(
    verification_status=verification_status,
    confidence_score=confidence_score,
    face_match_score=match_result.confidence,
    ocr_data=ocr_data,  # ← Sent in response
    processing_time_ms=processing_time_ms,
    face_verification_details=match_result.to_dict()
)
```

### **Schema Definition:**

**File**: `api/schemas.py` (lines 26-44)

```python
class OCRFields(BaseModel):
    """Structured fields extracted from ID document."""
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    document_number: Optional[str] = None
    nationality: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    place_of_birth: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
```

---

## ❓ FAQ

### **Q: Is the OCR data sent in the response?**
✅ **Yes!** It's in `response.ocr_data.fields`

### **Q: What if a field is not detected?**
The field will be `null`. Example: `"place_of_birth": null`

### **Q: How do I calculate age from date_of_birth?**
Parse the date (format: `DD.MM.YYYY`) and calculate difference from today.

### **Q: What document types are supported?**
- Passport
- Driver's License
- National ID
- ID Card
- PAN Card (Indian)
- And more...

### **Q: Can I get only OCR without face matching?**
Yes! Use `/api/v1/ocr/extract` endpoint (only needs `document` field)

---

## 🎯 Summary

✅ **OCR data IS being sent** in every response  
✅ **All extracted fields** are in `ocr_data.fields`  
✅ **9 fields available**: name, DOB, doc number, nationality, gender, dates, address  
✅ **Fields can be null** if not detected  
✅ **Works for all document types**  

**No changes needed** - the data is already there! 🎉

---

## 📚 More Documentation

- **Complete API Reference**: `API_DOCUMENTATION.md`
- **Request/Response Examples**: `API_REQUEST_RESPONSE_EXAMPLES.md`
- **Data Flow Diagram**: `API_DATA_FLOW.md`
- **Test Script**: `test_api_example.py`

---

**Last Updated**: December 15, 2024

