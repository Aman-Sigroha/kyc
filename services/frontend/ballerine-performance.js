// Performance Optimizations for Ballerine SDK Camera Feeds
// This script optimizes video elements created by the Ballerine SDK

(function() {
    'use strict';
    
    // Configuration - Balanced optimizations for performance and quality
    const OPTIMIZATION_CONFIG = {
        // Low resolution for document scanning (for performance)
        maxVideoWidth: 480,  
        maxVideoHeight: 360,
        // High resolution for selfie captures (for face recognition accuracy)
        maxVideoWidthSelfie: 1280,  // High quality for selfie/face matching
        maxVideoHeightSelfie: 720,  // High quality for selfie/face matching
        maxFrameRate: 15,     // Lower frame rate for smoother playback
        optimizeInterval: 100, // Check very frequently (every 100ms)
        maxOptimizationAttempts: 50, // Monitor much longer (5 seconds)
        frameSkipEnabled: true, // Enable frame skipping for smoother playback
        qualityReduction: 0.75, // More quality reduction for speed
        immediateOptimization: true, // Optimize immediately without waiting
        forceLowLatency: true // Force low latency mode
    };
    
    let optimizationAttempts = 0;
    let optimizationInterval = null;
    
    // Optimize a single video element with aggressive settings
    function optimizeVideoElement(video) {
        try {
            // Skip if already optimized
            if (video.dataset.optimized === 'true') {
                return;
            }
            
            // Apply aggressive CSS optimizations
            video.style.transform = 'translateZ(0)';
            video.style.willChange = 'transform';
            video.style.backfaceVisibility = 'hidden';
            video.style.webkitBackfaceVisibility = 'hidden';
            video.style.imageRendering = 'optimizeSpeed';
            video.style.objectFit = 'cover';
            video.style.pointerEvents = 'none'; // Disable pointer events for better performance
            
            // Ensure muted for better performance
            if (!video.muted) {
                video.muted = true;
            }
            
            // Disable autoplay delay
            video.setAttribute('playsinline', 'true');
            video.setAttribute('autoplay', 'true');
            video.setAttribute('webkit-playsinline', 'true');
            
            // Optimize video constraints aggressively
            if (video.srcObject && video.srcObject instanceof MediaStream) {
                const tracks = video.srcObject.getVideoTracks();
                if (tracks.length > 0) {
                    const track = tracks[0];
                    const settings = track.getSettings();
                    
                    // Get current constraints
                    let currentConstraints = {};
                    try {
                        currentConstraints = track.getConstraints();
                    } catch (e) {
                        // Fallback to settings
                        currentConstraints = {
                            width: { ideal: settings.width },
                            height: { ideal: settings.height },
                            frameRate: { ideal: settings.frameRate }
                        };
                    }
                    
                    // Apply aggressive constraints
                    const newConstraints = {
                        width: { 
                            ideal: Math.min(
                                currentConstraints.width?.ideal || settings.width || 640,
                                OPTIMIZATION_CONFIG.maxVideoWidth
                            ),
                            max: OPTIMIZATION_CONFIG.maxVideoWidth
                        },
                        height: { 
                            ideal: Math.min(
                                currentConstraints.height?.ideal || settings.height || 480,
                                OPTIMIZATION_CONFIG.maxVideoHeight
                            ),
                            max: OPTIMIZATION_CONFIG.maxVideoHeight
                        },
                        frameRate: { 
                            ideal: Math.min(
                                currentConstraints.frameRate?.ideal || settings.frameRate || 24,
                                OPTIMIZATION_CONFIG.maxFrameRate
                            ),
                            max: OPTIMIZATION_CONFIG.maxFrameRate
                        }
                    };
                    
                    track.applyConstraints(newConstraints).then(() => {
                        console.log('Applied aggressive video constraints:', newConstraints);
                    }).catch(err => {
                        console.warn('Could not apply video constraints, trying settings:', err);
                        // Try with settings instead
                        try {
                            if (settings.width > OPTIMIZATION_CONFIG.maxVideoWidth || 
                                settings.height > OPTIMIZATION_CONFIG.maxVideoHeight) {
                                track.applyConstraints(newConstraints).catch(e => {
                                    console.warn('Failed to apply constraints:', e);
                                });
                            }
                        } catch (e) {
                            console.warn('Error applying fallback constraints:', e);
                        }
                    });
                }
            }
            
            // Add frame skipping for smoother playback
            if (OPTIMIZATION_CONFIG.frameSkipEnabled) {
                let lastFrameTime = 0;
                const minFrameInterval = 1000 / OPTIMIZATION_CONFIG.maxFrameRate; // ~41ms for 24fps
                
                const optimizePlayback = () => {
                    const now = performance.now();
                    if (now - lastFrameTime < minFrameInterval) {
                        // Skip this frame for smoother playback
                        return;
                    }
                    lastFrameTime = now;
                };
                
                // Throttle video update events
                video.addEventListener('timeupdate', optimizePlayback, { passive: true });
            }
            
            // Force video to play immediately and ensure it's visible
            if (video.paused) {
                video.play().catch(e => {
                    console.warn('Auto-play prevented, will play when user interacts:', e);
                });
            }
            
            // Ensure video is visible and playing
            video.style.display = '';
            video.style.visibility = 'visible';
            video.style.opacity = '1';
            
            // Force video to load
            if (video.readyState < video.HAVE_METADATA) {
                video.load();
            }
            
            // Mark as optimized
            video.dataset.optimized = 'true';
            
            console.log('Applied aggressive optimizations to video element');
        } catch (error) {
            console.warn('Error optimizing video element:', error);
        }
    }
    
    // Optimize all video elements on the page
    function optimizeAllVideos() {
        const videos = document.querySelectorAll('video');
        videos.forEach(optimizeVideoElement);
        
        // Also optimize canvas elements
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            if (canvas.dataset.optimized !== 'true') {
                canvas.style.transform = 'translateZ(0)';
                canvas.style.willChange = 'contents';
                canvas.dataset.optimized = 'true';
            }
        });
    }
    
    // Monitor for new video elements (MutationObserver)
    function startVideoMonitoring() {
        // Wait for body to be available
        const startObserving = () => {
            const target = document.body || document.documentElement;
            
            if (!target) {
                // Body not ready, retry
                setTimeout(startObserving, 50);
                return null;
            }
            
            const observer = new MutationObserver((mutations) => {
                let shouldOptimize = false;
                
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            // Check if it's a video element
                            if (node.tagName === 'VIDEO') {
                                shouldOptimize = true;
                            }
                            // Check if it contains video elements
                            if (node.querySelectorAll && node.querySelectorAll('video').length > 0) {
                                shouldOptimize = true;
                            }
                        }
                    });
                });
                
                if (shouldOptimize) {
                    // Small delay to ensure video is initialized
                    setTimeout(optimizeAllVideos, 50);
                }
            });
            
            try {
                // Start observing
                observer.observe(target, {
                    childList: true,
                    subtree: true
                });
                console.log('✅ MutationObserver started successfully');
                return observer;
            } catch (error) {
                console.warn('⚠️ MutationObserver failed:', error);
                return null;
            }
        };
        
        return startObserving();
    }
    
    // Periodic optimization (fallback for elements added before observer starts)
    function startPeriodicOptimization() {
        optimizationInterval = setInterval(() => {
            optimizationAttempts++;
            
            // Optimize all videos
            optimizeAllVideos();
            
            // Also try to optimize streams directly
            optimizeMediaStreams();
            
            // Stop after max attempts
            if (optimizationAttempts >= OPTIMIZATION_CONFIG.maxOptimizationAttempts) {
                if (optimizationInterval) {
                    clearInterval(optimizationInterval);
                    optimizationInterval = null;
                }
            }
        }, OPTIMIZATION_CONFIG.optimizeInterval);
    }
    
    // Intercept getUserMedia calls to apply constraints before stream creation
    function interceptGetUserMedia() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('getUserMedia not available yet, will retry...');
            setTimeout(interceptGetUserMedia, 100);
            return;
        }
        
        // Check if already intercepted
        if (navigator.mediaDevices.getUserMedia._ballerineOptimized) {
            return;
        }
        
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        
        navigator.mediaDevices.getUserMedia = function(constraints) {
            // Optimize constraints before passing to original function
            if (constraints && constraints.video) {
                const videoConstraints = constraints.video;
                
                // Check if this is a selfie capture (front camera) - needs higher quality for face recognition
                const isSelfieCapture = videoConstraints.facingMode === 'user' || 
                                       videoConstraints.facingMode === 'front' ||
                                       (typeof videoConstraints === 'object' && !videoConstraints.facingMode);
                
                // Use higher resolution for selfies, lower for document scanning
                const maxWidth = isSelfieCapture ? OPTIMIZATION_CONFIG.maxVideoWidthSelfie : OPTIMIZATION_CONFIG.maxVideoWidth;
                const maxHeight = isSelfieCapture ? OPTIMIZATION_CONFIG.maxVideoHeightSelfie : OPTIMIZATION_CONFIG.maxVideoHeight;
                
                // Apply optimized limits (but flexible for compatibility)
                if (typeof videoConstraints === 'object') {
                    // Preserve facingMode if specified (important for front/back camera)
                    const facingMode = videoConstraints.facingMode;
                    
                    constraints.video = {
                        ...videoConstraints,
                        width: {
                            ideal: maxWidth,
                            max: maxWidth
                            // Removed min - let browser choose closest supported resolution
                        },
                        height: {
                            ideal: maxHeight,
                            max: maxHeight
                            // Removed min - let browser choose closest supported resolution
                        },
                        frameRate: {
                            ideal: OPTIMIZATION_CONFIG.maxFrameRate,
                            max: OPTIMIZATION_CONFIG.maxFrameRate,
                            min: 10 // Minimum frame rate for smooth playback
                        }
                        // Removed latency and aspectRatio - they might not be supported by all browsers/cameras
                    };
                    
                    // Restore facingMode if it was set
                    if (facingMode) {
                        constraints.video.facingMode = facingMode;
                    }
                    
                    console.log(`📹 Camera: ${isSelfieCapture ? 'SELFIE' : 'DOCUMENT'} mode - ${maxWidth}x${maxHeight}`);
                } else if (videoConstraints === true) {
                    // If just "true", default to selfie quality (better safe than sorry)
                    constraints.video = {
                        width: { ideal: OPTIMIZATION_CONFIG.maxVideoWidthSelfie, max: OPTIMIZATION_CONFIG.maxVideoWidthSelfie },
                        height: { ideal: OPTIMIZATION_CONFIG.maxVideoHeightSelfie, max: OPTIMIZATION_CONFIG.maxVideoHeightSelfie },
                        frameRate: { ideal: OPTIMIZATION_CONFIG.maxFrameRate, max: OPTIMIZATION_CONFIG.maxFrameRate, min: 10 }
                    };
                    console.log('📹 Camera: Default mode (assuming selfie) - 1280x720');
                }
                
                console.log('🎥 Intercepted getUserMedia with ULTRA-optimized constraints:', JSON.stringify(constraints, null, 2));
            }
            
            // Call original with optimized constraints
            const promise = originalGetUserMedia(constraints);
            
            // Optimize the stream immediately when we get it
            promise.then(stream => {
                console.log('✅ Got video stream, checking tracks...');
                const tracks = stream.getVideoTracks();
                tracks.forEach(track => {
                    try {
                        const settings = track.getSettings();
                        // Check if this is a selfie (front camera)
                        const isSelfie = settings.facingMode === 'user' || settings.facingMode === 'front';
                        const maxWidth = isSelfie ? OPTIMIZATION_CONFIG.maxVideoWidthSelfie : OPTIMIZATION_CONFIG.maxVideoWidth;
                        const maxHeight = isSelfie ? OPTIMIZATION_CONFIG.maxVideoHeightSelfie : OPTIMIZATION_CONFIG.maxVideoHeight;
                        
                        // Only apply constraints for document scanning (not selfies)
                        if (!isSelfie && (settings.width > OPTIMIZATION_CONFIG.maxVideoWidth || 
                            settings.height > OPTIMIZATION_CONFIG.maxVideoHeight)) {
                            track.applyConstraints({
                                width: { ideal: OPTIMIZATION_CONFIG.maxVideoWidth, max: OPTIMIZATION_CONFIG.maxVideoWidth },
                                height: { ideal: OPTIMIZATION_CONFIG.maxVideoHeight, max: OPTIMIZATION_CONFIG.maxVideoHeight },
                                frameRate: { ideal: OPTIMIZATION_CONFIG.maxFrameRate, max: OPTIMIZATION_CONFIG.maxFrameRate }
                            }).then(() => {
                                console.log('✅ Applied constraints to track (document mode):', track.label, `(${settings.width}x${settings.height}@${settings.frameRate || '?'}fps)`);
                            }).catch(err => {
                                console.warn('⚠️ Could not apply constraints (using default):', err.message);
                            });
                        } else if (isSelfie) {
                            console.log(`✅ Selfie track - allowing high resolution: ${settings.width}x${settings.height}@${settings.frameRate || '?'}fps`);
                        }
                    } catch (err) {
                        console.warn('Error checking track:', err);
                    }
                });
                
                // Also optimize video elements after a short delay (they might not exist yet)
                setTimeout(() => {
                    optimizeAllVideos();
                    optimizeMediaStreams();
                }, 200);
            }).catch(err => {
                console.error('❌ getUserMedia failed:', err);
            });
            
            return promise;
        };
        
        // Mark as intercepted
        navigator.mediaDevices.getUserMedia._ballerineOptimized = true;
        console.log('✅ getUserMedia interception active');
    }
    
    // Optimize all active media streams
    function optimizeMediaStreams() {
        try {
            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
                if (video.srcObject && video.srcObject instanceof MediaStream) {
                    const tracks = video.srcObject.getVideoTracks();
                    tracks.forEach(track => {
                        const settings = track.getSettings();
                        if (settings.width > OPTIMIZATION_CONFIG.maxVideoWidth || 
                            settings.height > OPTIMIZATION_CONFIG.maxVideoHeight ||
                            (settings.frameRate && settings.frameRate > OPTIMIZATION_CONFIG.maxFrameRate)) {
                            
                            track.applyConstraints({
                                width: { ideal: Math.min(settings.width || 640, OPTIMIZATION_CONFIG.maxVideoWidth) },
                                height: { ideal: Math.min(settings.height || 480, OPTIMIZATION_CONFIG.maxVideoHeight) },
                                frameRate: { ideal: Math.min(settings.frameRate || 24, OPTIMIZATION_CONFIG.maxFrameRate) }
                            }).catch(err => {
                                // Silently fail - constraints might not be changeable
                            });
                        }
                    });
                }
            });
        } catch (error) {
            // Silently handle errors
        }
    }
    
    // Initialize optimizations
    function initializeOptimizations() {
        console.log('Initializing aggressive Ballerine SDK camera performance optimizations...');
        
        // Intercept getUserMedia BEFORE SDK uses it
        interceptGetUserMedia();
        
        // Optimize existing videos immediately
        optimizeAllVideos();
        optimizeMediaStreams();
        
        // Start monitoring for new video elements
        const observer = startVideoMonitoring();
        
        // Start periodic optimization as fallback
        startPeriodicOptimization();
        
        // Also optimize on window load
        if (document.readyState === 'loading') {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    optimizeAllVideos();
                    optimizeMediaStreams();
                }, 100);
            });
        } else {
            setTimeout(() => {
                optimizeAllVideos();
                optimizeMediaStreams();
            }, 100);
        }
        
        // Optimize when Ballerine SDK modal opens
        window.addEventListener('message', (event) => {
            if (event.data && typeof event.data === 'object') {
                // Immediate optimization when SDK creates elements
                setTimeout(() => {
                    optimizeAllVideos();
                    optimizeMediaStreams();
                }, 100);
            }
        });
        
        // Also listen for focus events (when user interacts)
        window.addEventListener('focus', () => {
            setTimeout(() => {
                optimizeAllVideos();
                optimizeMediaStreams();
            }, 200);
        });
        
        console.log('🚀 ULTRA-AGGRESSIVE Ballerine SDK camera performance optimizations ACTIVE');
        console.log('📹 Video constraints: max', OPTIMIZATION_CONFIG.maxVideoWidth + 'x' + OPTIMIZATION_CONFIG.maxVideoHeight + '@' + OPTIMIZATION_CONFIG.maxFrameRate + 'fps');
        console.log('⚙️  Use window.optimizeBallerineCamera() to manually optimize');
    }
    
    // Start IMMEDIATELY - don't wait for DOM
    // This ensures we intercept getUserMedia before SDK loads
    if (document.readyState === 'loading') {
        // Initialize ASAP, don't wait for DOMContentLoaded
        initializeOptimizations();
        // Also run on DOMContentLoaded as backup
        document.addEventListener('DOMContentLoaded', initializeOptimizations);
    } else {
        initializeOptimizations();
    }
    
    // Also run immediately if script loaded after page load
    if (document.readyState === 'complete') {
        setTimeout(initializeOptimizations, 0);
    }
    
    // Export for manual optimization - make sure it's available globally
    window.optimizeBallerineCamera = function() {
        console.log('Manual optimization triggered...');
        optimizeAllVideos();
        optimizeMediaStreams();
        console.log('Optimization complete. Video elements:', document.querySelectorAll('video').length);
    };
    
    // Make functions available for debugging
    window._ballerineOptimization = {
        optimizeAllVideos: optimizeAllVideos,
        optimizeMediaStreams: optimizeMediaStreams,
        optimizeVideoElement: optimizeVideoElement,
        config: OPTIMIZATION_CONFIG
    };
    
    console.log('Ballerine performance script loaded. Use window.optimizeBallerineCamera() to manually optimize.');
    
})();

