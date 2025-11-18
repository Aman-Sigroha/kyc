const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const app = express();

// Configuration from environment variables (Railway compatible)
const port = process.env.PORT || 3001;
const ML_BACKEND_URL = process.env.ML_BACKEND_URL || 'http://localhost:8000';

// CORS Configuration - Allow both local and Railway deployments
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow Railway domains
    if (origin.includes('railway.app')) {
      return callback(null, true);
    }
    
    // Allow your custom domain (add yours here)
    // if (origin.includes('yourdomain.com')) {
    //   return callback(null, true);
    // }
    
    callback(null, true); // Allow all for now
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));

// Increase payload limit to handle large image uploads (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB per file
    fieldSize: 50 * 1024 * 1024, // 50MB for field data (handles base64)
    fields: 100, // Max number of non-file fields
    files: 10 // Max number of files
  }
});

// Request logging middleware - LOG EVERYTHING (after body parsing)
app.use((req, res, next) => {
  console.log(`\n📨 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyPreview = JSON.stringify(req.body).substring(0, 500);
    console.log('Body preview:', bodyPreview + '...');
  }
  next();
});

// Mock data storage
let verifications = new Map();
let verificationIdCounter = 1;

// API Endpoints
app.post('/v2/enduser/verify', async (req, res) => {
  const verificationId = `verify_${verificationIdCounter++}`;
  const verification = {
    id: verificationId,
    status: 'pending',
    steps: [],
    createdAt: new Date().toISOString(),
    endUserInfo: req.body.endUserInfo || {}
  };
  
  verifications.set(verificationId, verification);
  
  // Check if documents are included (SDK sends them all at once)
  const { documents } = req.body;
  
  if (documents && documents.length > 0) {
    console.log(`\n🔍 Documents received! Processing with Python ML backend...`);
    console.log(`Number of documents: ${documents.length}`);
    
    try {
      // ⚠️ DEBUG: Log all document types received
      console.log('📋 Documents received from frontend:');
      documents.forEach((doc, idx) => {
        console.log(`  [${idx}] type="${doc.type}", metadata.side="${doc.metadata?.side}", has_pages=${!!doc.pages}`);
      });
      
      // Find the required documents
      const frontDoc = documents.find(d => d.type === 'id_card' || d.type === 'passport' || d.type === 'drivers_license' || d.type === 'id-card');
      const backDoc = documents.find(d => d.metadata?.side === 'back');
      const selfieDoc = documents.find(d => d.type === 'selfie' || d.type === 'face');
      
      console.log(`\n🔍 Matched documents:`);
      console.log(`  Front doc: ${frontDoc ? '✅ (type=' + frontDoc.type + ')' : '❌'}`);
      console.log(`  Back doc: ${backDoc ? '✅' : '❌'}`);
      console.log(`  Selfie doc: ${selfieDoc ? '✅ (type=' + selfieDoc.type + ', index=' + documents.indexOf(selfieDoc) + ')' : '❌'}`);
      
      if (frontDoc && selfieDoc) {
        // Process with ML backend
        const formData = new FormData();
        
        const base64ToBuffer = (base64String) => {
          const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
          return Buffer.from(base64Data, 'base64');
        };
        
        // Extract base64 from pages if needed
        const frontImage = frontDoc.pages?.[0]?.base64 || frontDoc.base64 || frontDoc.data;
        const selfieImage = selfieDoc.pages?.[0]?.base64 || selfieDoc.base64 || selfieDoc.data;
        
        console.log('📸 Image data check:');
        console.log('Front image type:', typeof frontImage);
        console.log('Front image length:', frontImage ? frontImage.substring(0, 50) + '...' : 'EMPTY');
        console.log('Selfie image type:', typeof selfieImage);
        console.log('Selfie image length:', selfieImage ? selfieImage.substring(0, 50) + '...' : 'EMPTY');
        
        if (!frontImage || !selfieImage) {
          console.error('❌ Missing image data!');
          return res.status(400).json({
            verificationId,
            status: 'error',
            message: 'Missing image data from camera'
          });
        }
        
        formData.append('id_document', base64ToBuffer(frontImage), {
          filename: 'id_front.jpg',
          contentType: 'image/jpeg'
        });
        
        formData.append('selfie_image', base64ToBuffer(selfieImage), {
          filename: 'selfie.jpg',
          contentType: 'image/jpeg'
        });
        
        console.log('🚀 Calling Python ML backend for verification...');
        console.log('ML Backend URL:', `${ML_BACKEND_URL}/api/v1/kyc/verify`);
        
        const mlResponse = await axios.post(
          `${ML_BACKEND_URL}/api/v1/kyc/verify`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 60000 // 60 second timeout
          }
        );
        
        console.log('✅ ML Backend Response received');
        console.log('Response status:', mlResponse.status);
        console.log('Response data keys:', Object.keys(mlResponse.data || {}));
        
        // Update verification with ML results
        verification.status = mlResponse.data.verification_status || mlResponse.data.status || 'pending';
        verification.result = mlResponse.data;
        
        // Return appropriate status code based on verification result
        // IMPORTANT: Ballerine SDK expects 200 OK for all responses
        // The status field in the response body determines success/rejection
        const verificationStatus = mlResponse.data.verification_status || mlResponse.data.status;
        
        // Always return 200 OK - SDK checks the status field in the body
        const response = {
          verificationId,
          status: verificationStatus,
          message: '',
          result: mlResponse.data
        };
        
        // Check if liveness was completed before approving
        // This ensures liveness check is mandatory
        const requiresLiveness = !req.headers['x-liveness-completed'] && 
                                  !req.body.liveness_completed &&
                                  verificationStatus === 'approved';
        
        if (verificationStatus === 'approved' || verificationStatus === 'success') {
          // If approved but no liveness check, return pending until liveness is done
          if (requiresLiveness) {
            console.log('⚠️ Verification approved but liveness check required - returning pending');
            response.status = 'pending';
            response.message = 'Verification pending - liveness check required';
            return res.status(200).json(response);
          }
          
          console.log('✅ Verification APPROVED');
          response.message = 'Identity verified successfully';
          return res.status(200).json(response);
        } else if (verificationStatus === 'pending') {
          console.log('⚠️ Verification PENDING');
          response.message = 'Verification pending - face matched but additional verification needed';
          // Still return 200, but with pending status
          return res.status(200).json(response);
        } else {
          console.log('❌ Verification REJECTED - Face matching below threshold');
          
          // Get the face match details from the response
          const faceMatchScore = mlResponse.data.face_match_score || mlResponse.data.face_verification_details?.confidence || 0;
          const cosineSimilarity = mlResponse.data.face_verification_details?.similarity_metrics?.cosine_similarity || 0;
          const threshold = mlResponse.data.face_verification_details?.threshold_used || 0.2;
          
          // Log detailed comparison for debugging
          console.log('📊 Face Matching Details:');
          console.log(`  - cosine_similarity: ${(cosineSimilarity * 100).toFixed(1)}%`);
          console.log(`  - face_match_score (normalized): ${(faceMatchScore * 100).toFixed(1)}%`);
          console.log(`  - threshold_used: ${(threshold * 100).toFixed(1)}%`);
          console.log(`  - Verification uses: cosine_similarity (${(cosineSimilarity * 100).toFixed(1)}%) >= threshold (${(threshold * 100).toFixed(1)}%)`);
          console.log(`  - Result: ${cosineSimilarity >= threshold ? 'PASS' : 'FAIL'}`);
          
          // Clear rejection message for frontend - use cosine similarity for accuracy
          const actualMatchPercent = (cosineSimilarity * 100).toFixed(1);
          const thresholdPercent = (threshold * 100).toFixed(1);
          response.message = `Unsuccessful - Face matching score (${actualMatchPercent}%) is below the required threshold (${thresholdPercent}%). Please try again with better lighting and ensure your face is clearly visible.`;
          response.reason = 'Face verification failed - matching percentage below threshold';
          
          // Return 200 OK but with rejected status - SDK will show rejection screen
          console.log('Returning REJECTED response to frontend (HTTP 200 with status=rejected)');
          console.log(`Face match (cosine): ${actualMatchPercent}%, Threshold: ${thresholdPercent}%`);
          return res.status(200).json(response);
        }
      }
    } catch (error) {
      console.error('❌ Error processing with ML backend:', error.message);
      console.error('Error stack:', error.stack);
      verification.status = 'error';
      
      // Return proper error response to frontend
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        // Backend validation error (400) - return as rejected verification
        // IMPORTANT: Return 200 OK (not 422) so Ballerine SDK shows rejection message, not error
        if (error.response.status === 400) {
          const errorMessage = error.response.data.message || error.response.data.detail || '';
          
          // Check if it's a face matching failure
          let rejectionMessage = 'Unsuccessful - Please try again.';
          if (errorMessage.includes('face') || errorMessage.includes('match') || errorMessage.includes('similarity')) {
            rejectionMessage = 'Unsuccessful - Face matching failed. Please ensure your face is clearly visible and matches your ID photo. Try again with better lighting.';
          } else if (errorMessage.includes('detect')) {
            rejectionMessage = 'Unsuccessful - Could not detect face in the image. Please ensure your face is clearly visible. Try again.';
          } else {
            rejectionMessage = `Unsuccessful - ${errorMessage}. Please try again.`;
          }
          
          console.log('❌ Validation error - returning as rejected (200 OK)');
          return res.status(200).json({
            verificationId,
            status: 'rejected',
            message: rejectionMessage,
            reason: 'Validation error',
            result: error.response.data
          });
        }
        
        // Backend server error (500) - return as rejected verification
        // IMPORTANT: Return 200 OK (not 422) so Ballerine SDK shows rejection message, not error
        if (error.response.status === 500) {
          console.error('Python ML backend returned 500 error:', error.response.data);
          console.log('❌ Backend server error - returning as rejected (200 OK)');
          return res.status(200).json({
            verificationId,
            status: 'rejected',
            message: 'Unsuccessful - Verification service temporarily unavailable. Please try again.',
            reason: 'Backend error',
            result: error.response.data
          });
        }
      }
      
      // Network/connection errors (ECONNREFUSED, ETIMEDOUT, etc.)
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('connect')) {
        console.error('❌ Cannot connect to Python ML backend at', ML_BACKEND_URL);
        console.error('Make sure the Python backend is running on port 8000');
        return res.status(503).json({
          verificationId,
          status: 'error',
          message: 'Verification service unavailable',
          reason: 'ML backend not available',
          error: 'Cannot connect to ML backend. Please ensure it is running on port 8000.'
        });
      }
      
      // Other errors - return as technical error with 500 but with more details
      console.error('Full error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      return res.status(500).json({
        verificationId,
        status: 'error',
        message: 'Technical error during verification',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  
  // Default response if no documents or processing failed
  res.json({
    verificationId,
    status: 'pending',
    message: 'Verification started successfully'
  });
});

app.get('/v2/enduser/verify/status/:verificationId', (req, res) => {
  const { verificationId } = req.params;
  const verification = verifications.get(verificationId);
  
  if (!verification) {
    return res.status(404).json({ error: 'Verification not found' });
  }
  
  res.json({
    verificationId,
    status: verification.status,
    steps: verification.steps,
    createdAt: verification.createdAt
  });
});

app.post('/v2/enduser/verify/partial', (req, res) => {
  const { verificationId, stepData } = req.body;
  const verification = verifications.get(verificationId);
  
  if (!verification) {
    return res.status(404).json({ error: 'Verification not found' });
  }
  
  // Add step data
  verification.steps.push({
    step: stepData.step,
    data: stepData.data,
    timestamp: new Date().toISOString()
  });
  
  // Update status based on steps
  if (verification.steps.length >= 3) {
    verification.status = 'completed';
  }
  
  // Handle camera timeout errors
  if (stepData.step === 'document-photo' || stepData.step === 'selfie') {
    if (stepData.data && stepData.data.error && stepData.data.error.includes('Timeout')) {
      return res.json({
        verificationId,
        status: verification.status,
        message: 'Camera timeout detected. Please try again or check camera permissions.',
        error: 'CAMERA_TIMEOUT',
        retry: true
      });
    }
  }
  
  res.json({
    verificationId,
    status: verification.status,
    message: 'Step data processed successfully'
  });
});

app.get('/v2/clients/:clientId/config', (req, res) => {
  const { clientId } = req.params;
  
  res.json({
    clientId,
    config: {
      allowedDocuments: ['passport', 'drivers_license', 'id_card'],
      selfieRequired: true,
      livenessCheck: true,
      maxFileSize: 10485760, // 10MB
      allowedImageTypes: ['image/jpeg', 'image/png'],
      camera: {
        timeout: 30000, // 30 seconds
        retryAttempts: 3,
        constraints: {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment' // Use back camera
          }
        }
      }
    }
  });
});

// ============================================
// Python ML Backend Integration Endpoints
// ============================================

// Proxy to Python ML Backend - KYC Verification with Face Matching
app.post('/api/v1/kyc/verify', upload.fields([
  { name: 'id_document', maxCount: 1 },
  { name: 'id_document_back', maxCount: 1 },
  { name: 'selfie_image', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Forwarding KYC verification request to Python ML backend...');
    console.log('Files received:', {
      id_document: !!req.files?.id_document,
      id_document_back: !!req.files?.id_document_back,
      selfie_image: !!req.files?.selfie_image
    });
    
    // Create FormData to forward files to ML backend
    const formData = new FormData();
    
    // Add files if they exist
    if (req.files?.id_document?.[0]) {
      formData.append('id_document', req.files.id_document[0].buffer, {
        filename: req.files.id_document[0].originalname || 'id_document.jpg',
        contentType: req.files.id_document[0].mimetype || 'image/jpeg'
      });
    }
    
    if (req.files?.id_document_back?.[0]) {
      formData.append('id_document_back', req.files.id_document_back[0].buffer, {
        filename: req.files.id_document_back[0].originalname || 'id_document_back.jpg',
        contentType: req.files.id_document_back[0].mimetype || 'image/jpeg'
      });
    }
    
    if (req.files?.selfie_image?.[0]) {
      formData.append('selfie_image', req.files.selfie_image[0].buffer, {
        filename: req.files.selfie_image[0].originalname || 'selfie.jpg',
        contentType: req.files.selfie_image[0].mimetype || 'image/jpeg'
      });
    }
    
    // Validate required files
    if (!req.files?.id_document?.[0]) {
      return res.status(400).json({
        error: 'Missing required file',
        details: [{ type: 'missing', loc: ['body', 'id_document'] }]
      });
    }
    
    if (!req.files?.selfie_image?.[0]) {
      return res.status(400).json({
        error: 'Missing required file',
        details: [{ type: 'missing', loc: ['body', 'selfie_image'] }]
      });
    }
    
    // Forward to ML backend
    const response = await axios.post(
      `${ML_BACKEND_URL}/api/v1/kyc/verify`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000 // 60 second timeout
      }
    );
    
    console.log('✅ ML Backend response received');
    res.json(response.data);
  } catch (error) {
    console.error('❌ Error calling Python ML backend:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    res.status(error.response?.status || 500).json({
      error: 'Failed to process KYC verification',
      details: error.response?.data || error.message
    });
  }
});

// Handle Ballerine SDK final submission with images
app.post('/v2/enduser/verify/final', async (req, res) => {
  try {
    const { verificationId, documents } = req.body;
    console.log('Processing final KYC submission from Ballerine SDK...');
    
    if (!documents || documents.length === 0) {
      return res.status(400).json({ error: 'No documents provided' });
    }
    
    // Extract front, back, and selfie images
    const frontDoc = documents.find(d => d.type === 'id_card' || d.type === 'passport' || d.type === 'drivers_license');
    const backDoc = documents.find(d => d.metadata?.side === 'back');
    const selfieDoc = documents.find(d => d.type === 'selfie');
    
    if (!frontDoc || !selfieDoc) {
      return res.status(400).json({ 
        error: 'Missing required documents',
        details: 'Front ID and selfie are required'
      });
    }
    
    // Convert base64 images to form data
    const FormData = require('form-data');
    const formData = new FormData();
    
    // Helper to convert base64 to buffer
    const base64ToBuffer = (base64String) => {
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(base64Data, 'base64');
    };
    
    // Add ID document (front)
    formData.append('id_document', base64ToBuffer(frontDoc.data), {
      filename: 'id_front.jpg',
      contentType: 'image/jpeg'
    });
    
    // Add selfie
    formData.append('selfie_image', base64ToBuffer(selfieDoc.data), {
      filename: 'selfie.jpg',
      contentType: 'image/jpeg'
    });
    
    console.log('Calling Python ML backend for verification...');
    
    // Call Python ML backend
    const mlResponse = await axios.post(
      `${ML_BACKEND_URL}/api/v1/kyc/verify`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );
    
    console.log('ML Backend Response:', mlResponse.data);
    
    // Update verification status
    const verification = verifications.get(verificationId);
    if (verification) {
      verification.status = mlResponse.data.verification_status;
      verification.result = mlResponse.data;
    }
    
    // Return formatted response for Ballerine
    res.json({
      verificationId,
      status: mlResponse.data.verification_status,
      message: 'Verification completed successfully',
      result: {
        verification_status: mlResponse.data.verification_status,
        confidence_score: mlResponse.data.confidence_score,
        face_match_score: mlResponse.data.face_match_score,
        ocr_data: mlResponse.data.ocr_data,
        processing_time_ms: mlResponse.data.processing_time_ms
      }
    });
    
  } catch (error) {
    console.error('Error processing final verification:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to process verification',
      details: error.response?.data || error.message
    });
  }
});

// Proxy to Python ML Backend - OCR Extraction
app.post('/api/v1/kyc/ocr', async (req, res) => {
  try {
    console.log('Forwarding OCR request to Python ML backend...');
    
    const response = await axios.post(
      `${ML_BACKEND_URL}/api/v1/kyc/ocr`,
      req.body,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error calling Python ML backend for OCR:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to process OCR',
      details: error.response?.data || error.message
    });
  }
});

// ============================================
// Liveness Detection Endpoints
// ============================================

// Generate Liveness Challenge
app.get('/api/v1/liveness/challenge', async (req, res) => {
  try {
    console.log('Forwarding liveness challenge request to Python ML backend...');
    
    const response = await axios.get(
      `${ML_BACKEND_URL}/api/v1/liveness/challenge`
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error calling Python ML backend for challenge:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to generate liveness challenge',
      details: error.response?.data || error.message
    });
  }
});

// Verify Liveness Challenge
app.post('/api/v1/liveness/verify', async (req, res) => {
  try {
    console.log('Forwarding liveness verification request to Python ML backend...');
    console.log(`Challenge ID: ${req.body?.challenge_id}, Frames: ${req.body?.frames?.length || 0}`);
    
    const response = await axios.post(
      `${ML_BACKEND_URL}/api/v1/liveness/verify`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error calling Python ML backend for liveness verification:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to verify liveness challenge',
      details: error.response?.data || error.message
    });
  }
});

// Batch Liveness Detection (without challenge)
app.post('/api/v1/liveness/detect', async (req, res) => {
  try {
    console.log('Forwarding batch liveness detection request to Python ML backend...');
    console.log(`Frames: ${req.body?.frames?.length || 0}`);
    
    const response = await axios.post(
      `${ML_BACKEND_URL}/api/v1/liveness/detect`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error calling Python ML backend for batch detection:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to process batch liveness detection',
      details: error.response?.data || error.message
    });
  }
});

// Check Python ML Backend Health
app.get('/api/v1/ml/health', async (req, res) => {
  try {
    const response = await axios.get(`${ML_BACKEND_URL}/api/v1/health`);
    res.json({
      proxy: 'OK',
      mlBackend: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      proxy: 'OK',
      mlBackend: 'UNAVAILABLE',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    proxy: 'running',
    mlBackend: ML_BACKEND_URL,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Ballerine KYC Verification Service',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      mlHealth: '/api/v1/ml/health',
      kycVerify: '/api/v1/kyc/verify (POST)',
      ocrExtract: '/api/v1/kyc/ocr (POST)',
      livenessChallenge: '/api/v1/liveness/challenge (GET)',
      livenessVerify: '/api/v1/liveness/verify (POST)',
      livenessDetect: '/api/v1/liveness/detect (POST)',
      legacyVerify: '/v2/enduser/verify (POST)',
      legacyStatus: '/v2/enduser/verify/status/:id (GET)'
    }
  });
});

app.listen(port, () => {
  console.log(`\n===========================================`);
  console.log(`🚀 KYC Proxy Server Running`);
  console.log(`===========================================`);
  console.log(`Port: ${port}`);
  console.log(`Health: http://localhost:${port}/health`);
  console.log(`ML Backend: ${ML_BACKEND_URL}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===========================================\n`);
  console.log(`📡 API Endpoints:`);
  console.log(`  POST /api/v1/kyc/verify - KYC verification`);
  console.log(`  POST /api/v1/kyc/ocr - OCR extraction`);
  console.log(`  GET  /api/v1/ml/health - ML backend health`);
  console.log(`  GET  /api/v1/liveness/challenge - Generate liveness challenge`);
  console.log(`  POST /api/v1/liveness/verify - Verify liveness challenge`);
  console.log(`  POST /api/v1/liveness/detect - Batch liveness detection`);
  console.log(`  GET  /health - Proxy health`);
  console.log(`===========================================\n`);
});
