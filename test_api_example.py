#!/usr/bin/env python3
"""
Simple test script to demonstrate KYC API usage and response structure.
Shows exactly what data is sent and received.
"""

import requests
import json
from pathlib import Path

# Configuration
API_URL = "http://localhost:8000/api/v1/kyc/verify"
# API_URL = "https://kycflow-production.up.railway.app/api/v1/kyc/verify"  # Production

def test_kyc_verification(id_document_path: str, selfie_path: str):
    """
    Test KYC verification API and display the response.
    
    Args:
        id_document_path: Path to ID document image
        selfie_path: Path to selfie image
    """
    
    print("=" * 80)
    print("KYC VERIFICATION API TEST")
    print("=" * 80)
    print()
    
    # Check if files exist
    if not Path(id_document_path).exists():
        print(f"❌ Error: ID document not found at {id_document_path}")
        return
    
    if not Path(selfie_path).exists():
        print(f"❌ Error: Selfie not found at {selfie_path}")
        return
    
    print("📤 REQUEST:")
    print(f"  Endpoint: {API_URL}")
    print(f"  Method: POST")
    print(f"  Content-Type: multipart/form-data")
    print(f"  Files:")
    print(f"    - id_document: {id_document_path}")
    print(f"    - selfie_image: {selfie_path}")
    print()
    
    # Prepare files
    files = {
        'id_document': open(id_document_path, 'rb'),
        'selfie_image': open(selfie_path, 'rb')
    }
    
    try:
        print("⏳ Sending request...")
        response = requests.post(API_URL, files=files, timeout=60)
        
        print(f"✅ Response received (HTTP {response.status_code})")
        print()
        
        # Parse JSON response
        result = response.json()
        
        print("=" * 80)
        print("📥 RESPONSE:")
        print("=" * 80)
        print()
        
        # Display top-level fields
        print("🔍 VERIFICATION RESULT:")
        print(f"  Status: {result.get('verification_status', 'N/A')}")
        print(f"  Overall Confidence: {result.get('confidence_score', 0):.2%}")
        print(f"  Face Match Score: {result.get('face_match_score', 0):.2%}")
        print(f"  Processing Time: {result.get('processing_time_ms', 0)}ms")
        print(f"  Timestamp: {result.get('timestamp', 'N/A')}")
        print()
        
        # Display face verification details
        if 'face_verification_details' in result:
            face_details = result['face_verification_details']
            print("👤 FACE VERIFICATION DETAILS:")
            print(f"  Verified: {face_details.get('verified', False)}")
            print(f"  Confidence: {face_details.get('confidence', 0):.2%}")
            print(f"  Cosine Similarity: {face_details.get('similarity_metrics', {}).get('cosine_similarity', 0):.2%}")
            print(f"  Euclidean Distance: {face_details.get('similarity_metrics', {}).get('euclidean_distance', 0):.4f}")
            print(f"  Threshold Used: {face_details.get('threshold_used', 0):.2%}")
            print(f"  Message: {face_details.get('message', 'N/A')}")
            print()
        
        # Display OCR data - THIS IS THE IMPORTANT PART
        if 'ocr_data' in result:
            ocr_data = result['ocr_data']
            print("📄 OCR EXTRACTED DATA:")
            print(f"  Document Type: {ocr_data.get('document_type', 'N/A')}")
            print(f"  OCR Confidence: {ocr_data.get('confidence', 0):.2%}")
            print()
            
            # Display extracted fields
            if 'fields' in ocr_data:
                fields = ocr_data['fields']
                print("  📋 EXTRACTED FIELDS:")
                print(f"    ├─ Full Name: {fields.get('full_name') or 'Not detected'}")
                print(f"    ├─ Date of Birth: {fields.get('date_of_birth') or 'Not detected'}")
                print(f"    ├─ Document Number: {fields.get('document_number') or 'Not detected'}")
                print(f"    ├─ Nationality: {fields.get('nationality') or 'Not detected'}")
                print(f"    ├─ Gender: {fields.get('gender') or 'Not detected'}")
                print(f"    ├─ Issue Date: {fields.get('issue_date') or 'Not detected'}")
                print(f"    ├─ Expiry Date: {fields.get('expiry_date') or 'Not detected'}")
                print(f"    ├─ Place of Birth: {fields.get('place_of_birth') or 'Not detected'}")
                print(f"    └─ Address: {fields.get('address') or 'Not detected'}")
                print()
            
            # Display raw extracted text (truncated)
            extracted_text = ocr_data.get('extracted_text', '')
            if extracted_text:
                print("  📝 RAW EXTRACTED TEXT (first 200 chars):")
                print(f"    {extracted_text[:200]}...")
                print()
        
        # Display full JSON response
        print("=" * 80)
        print("📦 FULL JSON RESPONSE:")
        print("=" * 80)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print()
        
        # Summary
        print("=" * 80)
        print("✅ TEST COMPLETED SUCCESSFULLY")
        print("=" * 80)
        print()
        print("📊 SUMMARY:")
        print(f"  • Verification Status: {result.get('verification_status', 'N/A').upper()}")
        
        if 'ocr_data' in result and 'fields' in result['ocr_data']:
            fields = result['ocr_data']['fields']
            extracted_count = sum(1 for v in fields.values() if v is not None)
            total_fields = len(fields)
            print(f"  • OCR Fields Extracted: {extracted_count}/{total_fields}")
            print(f"  • Name: {'✅' if fields.get('full_name') else '❌'}")
            print(f"  • DOB: {'✅' if fields.get('date_of_birth') else '❌'}")
            print(f"  • Document Number: {'✅' if fields.get('document_number') else '❌'}")
            print(f"  • Nationality: {'✅' if fields.get('nationality') else '❌'}")
            print(f"  • Gender: {'✅' if fields.get('gender') else '❌'}")
        
        print()
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Cannot connect to API")
        print(f"   Make sure the server is running at {API_URL}")
        print("   Start it with: python -m uvicorn api.api:app --reload")
    except requests.exceptions.Timeout:
        print("❌ Error: Request timed out (>60 seconds)")
        print("   The server might be overloaded or processing is taking too long")
    except requests.exceptions.RequestException as e:
        print(f"❌ Error: {e}")
    except json.JSONDecodeError:
        print("❌ Error: Invalid JSON response")
        print(f"   Response text: {response.text[:500]}")
    finally:
        # Close files
        for f in files.values():
            f.close()


def main():
    """Main function."""
    import sys
    
    if len(sys.argv) != 3:
        print("Usage: python test_api_example.py <id_document_path> <selfie_path>")
        print()
        print("Example:")
        print("  python test_api_example.py test_images/id_card.jpg test_images/selfie.jpg")
        print()
        sys.exit(1)
    
    id_document_path = sys.argv[1]
    selfie_path = sys.argv[2]
    
    test_kyc_verification(id_document_path, selfie_path)


if __name__ == "__main__":
    main()

