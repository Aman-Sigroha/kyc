// Liveness Detection Frontend
// Handles camera access, frame capture, and challenge verification

const API_BASE_URL = window.location.hostname.includes('railway.app')
    ? 'https://kyc-proxy-production.up.railway.app'
    : 'http://localhost:3001';

let stream = null;
let challenge = null;
let capturedFrames = [];
let frameInterval = null;
let isCapturing = false;

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const challengeScreen = document.getElementById('challenge-screen');
const successScreen = document.getElementById('success-screen');
const errorScreen = document.getElementById('error-screen');

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const instruction = document.getElementById('instruction');
const countdown = document.getElementById('countdown');
const status = document.getElementById('status');

const startBtn = document.getElementById('start-btn');
const captureBtn = document.getElementById('capture-btn');
const retryBtn = document.getElementById('retry-btn');
const continueBtn = document.getElementById('continue-btn');
const tryAgainBtn = document.getElementById('try-again-btn');

// Check if we came from KYC flow
const isKycFlow = sessionStorage.getItem('kyc_flow_active') === 'true';
const returnUrl = sessionStorage.getItem('kyc_return_url') || '/index.html';

// Handle liveness success
function handleLivenessSuccess() {
    // Mark liveness as completed
    sessionStorage.setItem('liveness_completed', 'true');
    sessionStorage.setItem('liveness_timestamp', Date.now().toString());
    
    if (isKycFlow) {
        // Return to KYC flow
        window.location.href = returnUrl + '?liveness=passed';
    } else {
        // Standalone mode - go to index
        window.location.href = '/index.html';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initializeLiveness();
});

async function initializeLiveness() {
    try {
        // Generate challenge
        showScreen(loadingScreen);
        challenge = await generateChallenge();
        
        if (!challenge) {
            throw new Error('Failed to generate challenge');
        }

        // Show challenge screen
        showScreen(challengeScreen);
        updateInstruction(challenge.instruction);
        
        // Setup event listeners
        startBtn.addEventListener('click', startCamera);
        captureBtn.addEventListener('click', startChallengeCapture);
        retryBtn.addEventListener('click', resetChallenge);
        continueBtn.addEventListener('click', () => {
            window.location.href = '/index.html';
        });
        tryAgainBtn.addEventListener('click', resetChallenge);

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize liveness check. Please refresh the page.');
    }
}

// Generate challenge from API
async function generateChallenge() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/liveness/challenge`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Challenge generated:', data);
        
        // Log expiration info for debugging
        const expiresIn = Math.floor(data.expires_at - (Date.now() / 1000));
        console.log(`Challenge expires in ${expiresIn} seconds (at ${new Date(data.expires_at * 1000).toLocaleTimeString()})`);
        
        return data;

    } catch (error) {
        console.error('Challenge generation error:', error);
        updateStatus('Failed to generate challenge. Please try again.', 'error');
        return null;
    }
}

// Start camera
async function startCamera() {
    try {
        updateStatus('Requesting camera access...', 'info');
        
        // Optimize video constraints for better performance
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                facingMode: 'user',
                frameRate: { ideal: 30, max: 30 } // Limit frame rate
            },
            audio: false
        });

        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true; // Mute to improve performance
        
        await video.play();

        // Force hardware acceleration for smoother rendering
        video.style.transform = 'translateZ(0)';
        video.style.willChange = 'transform';
        
        // Optimize video rendering - use requestAnimationFrame for smooth playback
        const renderLoop = () => {
            if (video.readyState >= video.HAVE_CURRENT_DATA && !isCapturing) {
                animationFrameId = requestAnimationFrame(renderLoop);
            }
        };
        renderLoop();
        
        startBtn.style.display = 'none';
        captureBtn.style.display = 'block';
        updateStatus('Camera ready. Click "Capture Challenge" to begin.', 'success');

    } catch (error) {
        console.error('Camera error:', error);
        updateStatus('Camera access denied. Please enable camera permissions.', 'error');
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            alert('Camera permission is required for liveness check. Please enable it in your browser settings.');
        }
    }
}

// Start capturing frames for challenge
async function startChallengeCapture() {
    if (!challenge) {
        updateStatus('No challenge available. Generating new challenge...', 'info');
        challenge = await generateChallenge();
        if (!challenge) {
            updateStatus('Failed to generate challenge. Please refresh.', 'error');
            return;
        }
    }

    // Check if challenge is still valid
    const now = Date.now() / 1000;
    if (challenge.expires_at < now) {
        updateStatus('Challenge expired. Generating new challenge...', 'info');
        challenge = await generateChallenge();
        if (!challenge) {
            updateStatus('Failed to generate challenge. Please refresh.', 'error');
            return;
        }
    }

    if (!stream || video.readyState !== video.HAVE_ENOUGH_DATA) {
        updateStatus('Camera not ready. Please wait...', 'error');
        return;
    }

    isCapturing = true;
    capturedFrames = [];
    captureBtn.style.display = 'none';
    retryBtn.style.display = 'none';
    
    updateStatus('Starting capture in 3 seconds...', 'info');
    instruction.textContent = 'Get ready!';
    
    // Countdown
    let count = 3;
    const countdownInterval = setInterval(() => {
        if (count > 0) {
            countdown.textContent = count;
            count--;
        } else {
            clearInterval(countdownInterval);
            countdown.style.display = 'none';
            instruction.textContent = challenge.instruction;
            startFrameCapture();
        }
    }, 1000);
}

// Capture frames at regular intervals (optimized)
function startFrameCapture() {
    const FPS = 8; // Reduced to 8 FPS for better performance
    const CAPTURE_DURATION = 3000; // 3 seconds
    const intervalMs = 1000 / FPS;
    const maxFrames = Math.floor((CAPTURE_DURATION / 1000) * FPS);
    
    let frameCount = 0;
    let lastStatusUpdate = 0;
    
    updateStatus(`Capturing frames... (${frameCount}/${maxFrames})`, 'info');
    
    frameInterval = setInterval(() => {
        if (frameCount >= maxFrames) {
            clearInterval(frameInterval);
            stopFrameCapture();
            return;
        }

        // Capture frame (throttled to avoid blocking UI)
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            captureFrame();
        }
        
        frameCount++;
        
        // Update status less frequently to reduce UI lag
        const now = Date.now();
        if (now - lastStatusUpdate > 200) {
            updateStatus(`Capturing frames... (${frameCount}/${maxFrames})`, 'info');
            lastStatusUpdate = now;
        }
        
    }, intervalMs);
}

// Capture a single frame (optimized)
function captureFrame() {
    try {
        // Use actual video dimensions but scale down for better performance
        const scale = 0.7; // Scale down by 30% for faster processing
        canvas.width = Math.floor(video.videoWidth * scale);
        canvas.height = Math.floor(video.videoHeight * scale);
        
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        
        // Use image smoothing for better quality at lower resolution
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // IMPORTANT: Flip the canvas horizontally to match the mirrored video
        // This fixes the left/right reversal issue
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        // Draw video frame (flipped horizontally)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Restore context
        ctx.restore();
        
        // Convert to base64 with lower quality for faster encoding
        const base64 = canvas.toDataURL('image/jpeg', 0.7); // Reduced quality for speed
        capturedFrames.push(base64);
        
    } catch (error) {
        console.error('Frame capture error:', error);
    }
}

// Stop capturing and verify
async function stopFrameCapture() {
    isCapturing = false;
    
    if (capturedFrames.length === 0) {
        updateStatus('No frames captured. Please try again.', 'error');
        captureBtn.style.display = 'block';
        retryBtn.style.display = 'block';
        return;
    }

    updateStatus(`Verifying ${capturedFrames.length} frames...`, 'info');
    
    try {
        const result = await verifyChallenge(challenge.challenge_id, capturedFrames);
        
        if (result.status === 'pass') {
            showScreen(successScreen);
            stopCamera();
        } else {
            updateStatus(`Challenge failed: ${result.message}`, 'error');
            captureBtn.style.display = 'block';
            retryBtn.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Verification error:', error);
        updateStatus('Verification failed. Please try again.', 'error');
        captureBtn.style.display = 'block';
        retryBtn.style.display = 'block';
    }
}

// Verify challenge with captured frames
async function verifyChallenge(challengeId, frames) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/liveness/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                challenge_id: challengeId,
                frames: frames
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('Verification result:', data);
        return data;

    } catch (error) {
        console.error('Verification API error:', error);
        throw error;
    }
}

// Reset challenge
async function resetChallenge() {
    stopCamera();
    capturedFrames = [];
    isCapturing = false;
    
    if (frameInterval) {
        clearInterval(frameInterval);
        frameInterval = null;
    }
    
    countdown.style.display = 'none';
    updateStatus('Generating new challenge...', 'info');
    captureBtn.style.display = 'none';
    retryBtn.style.display = 'none';
    
    // Generate new challenge
    challenge = await generateChallenge();
    if (challenge) {
        updateInstruction(challenge.instruction);
        startBtn.style.display = 'block';
        updateStatus('Camera ready. Click "Start Camera" to begin.', 'success');
        
        // Log challenge expiration time for debugging
        const expiresIn = Math.floor(challenge.expires_at - Date.now() / 1000);
        console.log(`Challenge expires in ${expiresIn} seconds`);
    } else {
        updateStatus('Failed to generate challenge. Please refresh the page.', 'error');
    }
}

// Stop camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (video.srcObject) {
        video.srcObject = null;
    }
    
    // Cancel animation frame
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Update instruction text
function updateInstruction(text) {
    instruction.textContent = text;
}

// Update status message
function updateStatus(message, type = '') {
    status.textContent = message;
    status.className = `status ${type}`;
}

// Show specific screen
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// Show error
function showError(message) {
    document.getElementById('error-message').textContent = message;
    showScreen(errorScreen);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopCamera();
});

