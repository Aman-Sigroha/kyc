// Custom KYC Frontend Application
class KYCFlow {
    constructor() {
        this.currentScreen = 'welcome-screen';
        this.selectedDocumentType = null;
        this.capturedImages = {
            front: null,
            back: null,
            selfie: null
        };
        this.currentStream = null;
        this.backendUrl = this.detectBackendUrl();
        this.verificationDetails = null;
        
        this.initialize();
    }

    detectBackendUrl() {
        const isProduction = window.location.hostname.includes('railway.app');
        return isProduction 
            ? 'https://kyc-proxy-production.up.railway.app'
            : 'http://localhost:3001';
    }

    initialize() {
        this.setupEventListeners();
        this.showScreen('welcome-screen');
    }

    setupEventListeners() {
        // Welcome screen
        document.getElementById('start-btn').addEventListener('click', () => {
            this.showScreen('document-selection-screen');
        });

        // Document selection
        document.querySelectorAll('.document-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectedDocumentType = e.currentTarget.dataset.type;
                this.showScreen('document-front-screen');
                this.startCamera('front-video', 'environment'); // Use back camera for documents
            });
        });

        // Document front capture
        document.getElementById('capture-front-btn').addEventListener('click', () => {
            this.capturePhoto('front-video', 'front-canvas', 'front');
        });
        document.getElementById('retake-front-btn').addEventListener('click', () => {
            this.showScreen('document-front-screen');
            this.startCamera('front-video', 'environment');
        });
        document.getElementById('approve-front-btn').addEventListener('click', () => {
            this.showScreen('document-back-screen');
            this.startCamera('back-video', 'environment');
        });
        document.getElementById('retake-front-review-btn').addEventListener('click', () => {
            this.showScreen('document-front-screen');
            this.startCamera('front-video', 'environment');
        });

        // Document back capture
        document.getElementById('capture-back-btn').addEventListener('click', () => {
            this.capturePhoto('back-video', 'back-canvas', 'back');
        });
        document.getElementById('retake-back-btn').addEventListener('click', () => {
            this.showScreen('document-back-screen');
            this.startCamera('back-video', 'environment');
        });
        document.getElementById('approve-back-btn').addEventListener('click', () => {
            this.showScreen('selfie-screen');
            this.startCamera('selfie-video', 'user'); // Use front camera for selfie
        });
        document.getElementById('retake-back-review-btn').addEventListener('click', () => {
            this.showScreen('document-back-screen');
            this.startCamera('back-video', 'environment');
        });

        // Selfie capture
        document.getElementById('capture-selfie-btn').addEventListener('click', () => {
            this.capturePhoto('selfie-video', 'selfie-canvas', 'selfie');
        });
        document.getElementById('retake-selfie-btn').addEventListener('click', () => {
            this.showScreen('selfie-screen');
            this.startCamera('selfie-video', 'user');
        });
        document.getElementById('approve-selfie-btn').addEventListener('click', () => {
            this.submitVerification();
        });
        document.getElementById('retake-selfie-review-btn').addEventListener('click', () => {
            this.showScreen('selfie-screen');
            this.startCamera('selfie-video', 'user');
        });

        // Error handling
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.resetFlow();
        });
    }

    showScreen(screenId) {
        // Stop any active camera
        this.stopCamera();

        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
        }
    }

    async startCamera(videoId, facingMode) {
        try {
            const video = document.getElementById(videoId);
            if (!video) return;

            // Stop existing stream
            this.stopCamera();

            // Request camera access with high quality
            const constraints = {
                video: {
                    width: { ideal: 1280, max: 1280 },
                    height: { ideal: 720, max: 720 },
                    facingMode: facingMode // 'user' for front, 'environment' for back
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            this.currentStream = stream;
            
            await video.play();
            console.log('Camera started:', facingMode);
        } catch (error) {
            console.error('Camera error:', error);
            alert('Unable to access camera. Please check permissions.');
        }
    }

    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
    }

    capturePhoto(videoId, canvasId, imageType) {
        const video = document.getElementById(videoId);
        const canvas = document.getElementById(canvasId);
        
        if (!video || !canvas) return;

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // For documents, crop to center 80% x 70% for better quality
        if (imageType === 'front' || imageType === 'back') {
            const cropX = canvas.width * 0.1;
            const cropY = canvas.height * 0.15;
            const cropWidth = canvas.width * 0.8;
            const cropHeight = canvas.height * 0.7;

            // Create cropped canvas
            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = cropWidth;
            croppedCanvas.height = cropHeight;
            const croppedCtx = croppedCanvas.getContext('2d');
            croppedCtx.imageSmoothingEnabled = true;
            croppedCtx.imageSmoothingQuality = 'high';
            croppedCtx.drawImage(
                canvas,
                cropX, cropY, cropWidth, cropHeight,
                0, 0, croppedCanvas.width, croppedCanvas.height
            );

            // Convert to base64
            this.capturedImages[imageType] = croppedCanvas.toDataURL('image/jpeg', 0.95);
        } else {
            // For selfie, use full image
            this.capturedImages[imageType] = canvas.toDataURL('image/jpeg', 0.95);
        }

        // Stop camera
        this.stopCamera();

        // Show review screen
        this.showReviewScreen(imageType);
    }

    showReviewScreen(imageType) {
        const reviewImg = document.getElementById(`${imageType}-review-img`);
        if (reviewImg && this.capturedImages[imageType]) {
            reviewImg.src = this.capturedImages[imageType];
        }

        const screenId = imageType === 'front' 
            ? 'document-front-review-screen'
            : imageType === 'back'
            ? 'document-back-review-screen'
            : 'selfie-review-screen';
        
        this.showScreen(screenId);
    }

    async submitVerification() {
        this.showScreen('loading-screen');

        try {
            // Prepare documents for submission
            const documents = [
                {
                    type: this.selectedDocumentType,
                    metadata: { side: 'front' },
                    pages: [{ base64: this.capturedImages.front }]
                },
                {
                    type: this.selectedDocumentType,
                    metadata: { side: 'back' },
                    pages: [{ base64: this.capturedImages.back }]
                },
                {
                    type: 'face',
                    metadata: {},
                    pages: [{ base64: this.capturedImages.selfie }]
                }
            ];

            console.log('📤 Submitting verification to backend...', {
                backendUrl: this.backendUrl,
                documentType: this.selectedDocumentType,
                hasFront: !!this.capturedImages.front,
                hasBack: !!this.capturedImages.back,
                hasSelfie: !!this.capturedImages.selfie
            });

            // Submit to backend FIRST
            const response = await fetch(`${this.backendUrl}/v2/enduser/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endUserInfo: {
                        id: 'user-' + Date.now(),
                        firstName: '',
                        lastName: ''
                    },
                    documents: documents
                })
            });

            console.log('📥 Backend response status:', response.status);

            const data = await response.json();
            console.log('📥 Backend response data:', data);

            // Store verification details for display
            this.verificationDetails = {
                faceMatchScore: data.face_match_score || data.face_verification_details?.confidence || null,
                cosineSimilarity: data.face_verification_details?.similarity_metrics?.cosine_similarity || null,
                confidenceScore: data.confidence_score || null,
                threshold: data.face_verification_details?.threshold_used || null
            };

            console.log('📊 Verification details:', this.verificationDetails);

            // Check if liveness is required (only if verification is approved/pending)
            const livenessCompleted = sessionStorage.getItem('liveness_completed') === 'true';
            const isApproved = data.status === 'approved' || data.status === 'verified' || data.status === 'pending';
            
            if (isApproved && !livenessCompleted) {
                console.log('✅ Verification approved/pending but liveness not completed - redirecting to liveness');
                // Redirect to liveness check
                sessionStorage.setItem('kyc_flow_active', 'true');
                sessionStorage.setItem('kyc_return_url', window.location.href);
                sessionStorage.setItem('captured_images', JSON.stringify(this.capturedImages));
                sessionStorage.setItem('document_type', this.selectedDocumentType);
                sessionStorage.setItem('verification_status', data.status);
                window.location.href = '/liveness.html';
                return;
            }

            // Handle results
            if (data.status === 'approved' || data.status === 'verified') {
                this.showSuccess(data);
            } else if (data.status === 'rejected' || data.status === 'failed') {
                this.showError(data.message || 'Verification failed. Please try again.', data);
            } else if (data.status === 'pending' && livenessCompleted) {
                // Pending but liveness done - show success
                this.showSuccess(data);
            } else {
                this.showError('Unexpected response from server.', data);
            }
        } catch (error) {
            console.error('❌ Verification error:', error);
            this.showError('An error occurred during verification. Please try again.');
        }
    }

    showSuccess(data) {
        this.showScreen('success-screen');
        
        // Display verification details
        const detailsContainer = document.getElementById('verification-details');
        const faceMatchScoreEl = document.getElementById('face-match-score');
        const confidenceScoreEl = document.getElementById('confidence-score');
        
        if (this.verificationDetails.faceMatchScore !== null) {
            detailsContainer.style.display = 'block';
            
            // Show face match score (prefer cosine similarity if available, otherwise normalized score)
            const matchScore = this.verificationDetails.cosineSimilarity !== null 
                ? this.verificationDetails.cosineSimilarity 
                : this.verificationDetails.faceMatchScore;
            
            faceMatchScoreEl.textContent = `${(matchScore * 100).toFixed(1)}%`;
            
            // Show confidence score
            if (this.verificationDetails.confidenceScore !== null) {
                confidenceScoreEl.textContent = `${(this.verificationDetails.confidenceScore * 100).toFixed(1)}%`;
            } else {
                confidenceScoreEl.textContent = 'N/A';
            }
        } else {
            detailsContainer.style.display = 'none';
        }
    }

    showError(message, data = null) {
        document.getElementById('error-message').textContent = message;
        
        // Display error details if available
        const errorDetailsContainer = document.getElementById('error-details');
        const errorFaceMatchScoreEl = document.getElementById('error-face-match-score');
        const errorThresholdEl = document.getElementById('error-threshold');
        
        if (data && this.verificationDetails.faceMatchScore !== null) {
            errorDetailsContainer.style.display = 'block';
            
            // Show face match score
            const matchScore = this.verificationDetails.cosineSimilarity !== null 
                ? this.verificationDetails.cosineSimilarity 
                : this.verificationDetails.faceMatchScore;
            
            errorFaceMatchScoreEl.textContent = `${(matchScore * 100).toFixed(1)}%`;
            
            // Show threshold
            if (this.verificationDetails.threshold !== null) {
                errorThresholdEl.textContent = `${(this.verificationDetails.threshold * 100).toFixed(1)}%`;
            } else {
                errorThresholdEl.textContent = 'N/A';
            }
        } else {
            errorDetailsContainer.style.display = 'none';
        }
        
        this.showScreen('error-screen');
    }

    resetFlow() {
        this.capturedImages = { front: null, back: null, selfie: null };
        this.selectedDocumentType = null;
        this.showScreen('welcome-screen');
    }
}

// Initialize when page loads
let kycFlow;
document.addEventListener('DOMContentLoaded', () => {
    // Check if returning from liveness
    const urlParams = new URLSearchParams(window.location.search);
    const livenessPassed = urlParams.get('liveness');
    
    if (livenessPassed === 'passed') {
        sessionStorage.setItem('liveness_completed', 'true');
        // Restore captured images
        const savedImages = sessionStorage.getItem('captured_images');
        if (savedImages) {
            const images = JSON.parse(savedImages);
            kycFlow = new KYCFlow();
            kycFlow.capturedImages = images;
            kycFlow.selectedDocumentType = sessionStorage.getItem('document_type');
            kycFlow.submitVerification();
            return;
        }
    }
    
    kycFlow = new KYCFlow();
});

