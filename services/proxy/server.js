const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
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
        
        console.log('✅ ML Backend Response:', mlResponse.data);
        
        // Update verification with ML results
        verification.status = mlResponse.data.verification_status;
        verification.result = mlResponse.data;
        
        // Return appropriate status code based on verification result
        // IMPORTANT: Ballerine SDK interprets HTTP status codes as:
        // - 200 = Success (shows green checkmark "Success" screen)
        // - 4xx/5xx = Failure (shows red X "Rejected" screen)
        if (mlResponse.data.verification_status === 'approved') {
          return res.status(200).json({
            verificationId,
            status: 'approved',
            message: 'Identity verified successfully',
            result: mlResponse.data
          });
        } else if (mlResponse.data.verification_status === 'pending') {
          // Return 422 for pending - SDK will show error screen
          return res.status(422).json({
            verificationId,
            status: 'pending',
            message: 'Verification pending - face matched but additional verification needed',
            result: mlResponse.data
          });
        } else {
          // Return 422 for rejected - SDK will show error screen
          const rejectedResponse = {
            verificationId,
            status: 'rejected',
            message: mlResponse.data.face_verification_details?.message || 'Verification rejected',
            reason: 'Face verification failed',
            result: mlResponse.data
          };
          console.log('❌ Returning REJECTED response to frontend (HTTP 422):', JSON.stringify(rejectedResponse, null, 2));
          return res.status(422).json(rejectedResponse);
        }
      }
    } catch (error) {
      console.error('❌ Error processing with ML backend:', error.message);
      verification.status = 'error';
      
      // Return proper error response to frontend
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        // Backend validation error (400) - return as rejected verification with 422
        if (error.response.status === 400) {
          return res.status(422).json({
            verificationId,
            status: 'rejected',
            message: error.response.data.message || 'Verification failed',
            reason: 'Validation error',
            error: error.response.data
          });
        }
      }
      
      // Other errors - return as technical error with 500
      return res.status(500).json({
        verificationId,
        status: 'error',
        message: 'Technical error during verification',
        error: error.message
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
app.post('/api/v1/kyc/verify', async (req, res) => {
  try {
    console.log('Forwarding KYC verification request to Python ML backend...');
    
    const response = await axios.post(
      `${ML_BACKEND_URL}/api/v1/kyc/verify`,
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
    console.error('Error calling Python ML backend:', error.message);
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
  console.log(`  GET  /health - Proxy health`);
  console.log(`===========================================\n`);
});
