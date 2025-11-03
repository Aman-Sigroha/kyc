// KYC Flow Integration for Liveness Detection
// Handles redirect to liveness check and return flow

(function() {
    'use strict';
    
    let flowMonitor = null;
    let hasRedirected = false;
    
    // Check for liveness completion on page load
    function checkLivenessStatus() {
        const urlParams = new URLSearchParams(window.location.search);
        const livenessPassed = urlParams.get('liveness');
        
        if (livenessPassed === 'passed') {
            // Liveness completed
            sessionStorage.setItem('liveness_completed', 'true');
            const wasKycFlow = sessionStorage.getItem('kyc_flow_active') === 'true';
            sessionStorage.removeItem('kyc_flow_active');
            
            // Continue with flow - reopen modal and it should proceed to final step
            if (typeof BallerineSDK !== 'undefined' && BallerineSDK.flows && wasKycFlow) {
                console.log('✅ Liveness check completed, continuing KYC flow to final step...');
                // Remove the query parameter to clean up URL
                const cleanUrl = window.location.href.split('?')[0];
                window.history.replaceState({}, document.title, cleanUrl);
                
                // Small delay to ensure SDK is ready
                setTimeout(() => {
                    try {
                        // Reopen the flow - it should now skip to final since liveness is done
                        BallerineSDK.flows.openModal('my-kyc-flow', {});
                        console.log('Flow reopened with liveness completed');
                    } catch (e) {
                        console.error('Error reopening flow:', e);
                        // Fallback: reload page
                        window.location.reload();
                    }
                }, 1000);
            }
            return true;
        }
        return false;
    }
    
    // Intercept network requests to /v2/enduser/verify
    // This intercepts the RESPONSE to check if verification passed, then redirects if needed
    function interceptVerifyRequest() {
        // Intercept fetch requests - DON'T block, but intercept response
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            const options = args[1] || {};
            const urlString = typeof url === 'string' ? url : (url?.url || url?.href || '');
            const method = (options.method || 'GET').toUpperCase();
            
            // Check if this is a POST to /v2/enduser/verify
            if (urlString && urlString.includes('/v2/enduser/verify') && method === 'POST') {
                console.log('🔍 Intercepting verification request - will check response status...');
                
                // Let the request go through, but intercept the response
                const fetchPromise = originalFetch.apply(this, args);
                
                return fetchPromise.then(async response => {
                    // Clone the response so we can read it without consuming it
                    const clonedResponse = response.clone();
                    
                    // Read the response body synchronously to check status BEFORE SDK processes it
                    let responseData;
                    try {
                        responseData = await clonedResponse.json();
                    } catch (err) {
                        console.warn('Could not parse verification response:', err);
                        // If we can't parse, return original response (might be an error)
                        return response;
                    }
                    
                    console.log('📊 Verification response received:', {
                        status: responseData.status || responseData.verification_status,
                        verification_status: responseData.verification_status,
                        hasLiveness: !!sessionStorage.getItem('liveness_completed'),
                        fullResponse: responseData // Log full response for debugging
                    });
                    
                       // Check verification status - check both fields
                       const verificationStatus = (responseData.status || responseData.verification_status || '').toLowerCase();
                       const verificationMessage = (responseData.message || ''); // Keep original case for display
                       const isApproved = verificationStatus === 'approved' || 
                                        verificationStatus === 'success' || 
                                        verificationStatus === 'verified';
                       const isPending = verificationStatus === 'pending';
                       const isRejected = verificationStatus === 'rejected' || 
                                         verificationStatus === 'failed' || 
                                         verificationStatus === 'error';
                       
                       // Check if pending is due to liveness requirement (vs other reasons like low OCR)
                       const isPendingForLiveness = isPending && verificationMessage.toLowerCase().includes('liveness check required');
                       
                       // Store verification status in sessionStorage so DOM observers can check it
                       // CRITICAL: Always store status and message for text replacement
                       sessionStorage.setItem('last_verification_status', verificationStatus);
                       sessionStorage.setItem('last_verification_message', verificationMessage || '');
                       
                       console.log('💾 Stored verification status:', {
                           status: verificationStatus,
                           message: verificationMessage,
                           isRejected: isRejected
                       });
                    
                    console.log('🔍 Status check:', {
                        verificationStatus,
                        verificationMessage,
                        isApproved,
                        isPending,
                        isPendingForLiveness,
                        isRejected,
                        hasLiveness: !!sessionStorage.getItem('liveness_completed'),
                        willRedirect: (isApproved || isPendingForLiveness) && !sessionStorage.getItem('liveness_completed') && !hasRedirected
                    });
                    
                    // CRITICAL: Only redirect if:
                    // 1. Approved (and liveness not done), OR
                    // 2. Pending SPECIFICALLY for liveness requirement (not for other reasons like low OCR)
                    if ((isApproved || isPendingForLiveness) && !sessionStorage.getItem('liveness_completed') && !hasRedirected) {
                        console.log(`🚨🚨🚨 FETCH CRITICAL: Verification ${isApproved ? 'APPROVED' : 'PENDING'} but liveness NOT completed - STOPPING everything and redirecting NOW...`);
                        
                        // Set flags IMMEDIATELY (synchronous)
                        hasRedirected = true;
                        sessionStorage.setItem('kyc_flow_active', 'true');
                        sessionStorage.setItem('kyc_return_url', window.location.href.split('?')[0]);
                        sessionStorage.setItem('kyc_flow_name', 'my-kyc-flow');
                        
                        // CRITICAL: Stop ALL execution and redirect IMMEDIATELY
                        if (typeof window.stop === 'function') {
                            window.stop(); // Stop loading/processing
                        }
                        window.location.replace('/liveness.html');
                        
                        // Return a rejected promise to prevent SDK from processing the response
                        // This blocks the SDK from showing success/pending screen
                        return Promise.reject(new Error('Liveness check required - redirecting'));
                    } else if (isRejected) {
                        console.log('❌ Verification REJECTED - allowing SDK to show error (no redirect)');
                        // Return original response so SDK can show error
                        return response;
                    } else if ((isApproved || isPendingForLiveness) && sessionStorage.getItem('liveness_completed')) {
                        console.log(`✅ Verification ${isApproved ? 'APPROVED' : 'PENDING (for liveness)'} and liveness completed - allowing success screen`);
                        // Return original response so SDK can show success
                        return response;
                    } else if (isPending && !isPendingForLiveness) {
                        console.log('⚠️ Verification PENDING (not for liveness - e.g., low OCR) - allowing SDK to show pending message');
                        // Return original response so SDK can show pending message
                        return response;
                    }
                    
                    // Default: return original response
                    return response;
                }).catch(error => {
                    // If request fails, let SDK handle the error
                    console.log('Verification request failed:', error);
                    return Promise.reject(error);
                });
            }
            
            // Not a verification request, proceed normally
            return originalFetch.apply(this, args);
        };
        
        // Also intercept XMLHttpRequest (SDK might use this)
        const originalXHRSend = XMLHttpRequest.prototype.send;
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        const originalOnReadyStateChange = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'onreadystatechange');
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._requestUrl = url;
            this._requestMethod = method;
            return originalXHROpen.call(this, method, url, ...rest);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            if (this._requestUrl && this._requestUrl.includes('/v2/enduser/verify') && 
                this._requestMethod === 'POST') {
                console.log('🔍 Intercepting XHR verification request - will check response status...');
                
                // Intercept the response
                const originalOnLoad = this.onload;
                const originalOnReadyStateChange = this.onreadystatechange;
                
                this.onreadystatechange = function() {
                    if (this.readyState === 4 && this.status === 200) {
                        try {
                            const responseText = this.responseText;
                            const data = JSON.parse(responseText);
                            
                            console.log('📊 XHR Verification response received:', {
                                status: data.status || data.verification_status,
                                hasLiveness: !!sessionStorage.getItem('liveness_completed')
                            });
                            
                            // Check verification status
                            const verificationStatus = (data.status || data.verification_status || '').toLowerCase();
                            const verificationMessage = (data.message || '').toLowerCase();
                            const isApproved = verificationStatus === 'approved' || 
                                             verificationStatus === 'success' || 
                                             verificationStatus === 'verified';
                            const isPending = verificationStatus === 'pending';
                            const isRejected = verificationStatus === 'rejected' || 
                                              verificationStatus === 'failed' || 
                                              verificationStatus === 'error';
                            
                            // Check if pending is due to liveness requirement (vs other reasons like low OCR)
                            const isPendingForLiveness = isPending && verificationMessage.includes('liveness check required');
                            
                               // Store status for DOM observers
                               // CRITICAL: Always store for text replacement
                               sessionStorage.setItem('last_verification_status', verificationStatus);
                               sessionStorage.setItem('last_verification_message', data.message || '');
                               
                               console.log('💾 XHR: Stored verification status:', {
                                   status: verificationStatus,
                                   message: data.message,
                                   isRejected: isRejected
                               });
                            
                            // CRITICAL: Only redirect if:
                            // 1. Approved (and liveness not done), OR
                            // 2. Pending SPECIFICALLY for liveness requirement (not for other reasons like low OCR)
                            if ((isApproved || isPendingForLiveness) && !sessionStorage.getItem('liveness_completed') && !hasRedirected) {
                                console.log(`🚨🚨🚨 XHR CRITICAL: Verification ${isApproved ? 'APPROVED' : 'PENDING'} but liveness NOT completed - BLOCKING SDK and redirecting NOW...`);
                                
                                // Set flags IMMEDIATELY (synchronous)
                                hasRedirected = true;
                                sessionStorage.setItem('kyc_flow_active', 'true');
                                sessionStorage.setItem('kyc_return_url', window.location.href.split('?')[0]);
                                sessionStorage.setItem('kyc_flow_name', 'my-kyc-flow');
                                
                                // CRITICAL: Stop execution and redirect IMMEDIATELY
                                window.stop(); // Stop loading/processing
                                window.location.replace('/liveness.html');
                                return; // Don't call original handler - block SDK
                            } else if (isRejected) {
                                console.log('❌ XHR: Verification REJECTED - allowing SDK to show error');
                                // Call original handler to show error
                                if (originalOnReadyStateChange) {
                                    originalOnReadyStateChange.call(this);
                                }
                                return;
                            } else if ((isApproved || isPending) && sessionStorage.getItem('liveness_completed')) {
                                console.log(`✅ XHR: Verification ${isApproved ? 'APPROVED' : 'PENDING'} and liveness completed - allowing success screen`);
                                // Call original handler to show success
                                if (originalOnReadyStateChange) {
                                    originalOnReadyStateChange.call(this);
                                }
                                return;
                            }
                        } catch (err) {
                            console.warn('Could not parse XHR response:', err);
                        }
                    }
                    
                    // Call original handler if it exists (for non-verification requests or errors)
                    if (originalOnReadyStateChange) {
                        originalOnReadyStateChange.call(this);
                    }
                };
            }
            return originalXHRSend.apply(this, args);
        };
        
        console.log('✅ Network request interception active - will check verification response and redirect only if approved');
    }
    
    // Monitor flow messages to detect when selfie check completes
    function startFlowMonitoring() {
        if (flowMonitor) return;
        
        let selfieCheckCompleted = false;
        
        // Listen for Ballerine SDK messages and DOM events
        const messageHandler = function(event) {
            if (hasRedirected || selfieCheckCompleted) return;
            
            // Ballerine SDK sends custom events
            if (event.data && typeof event.data === 'object') {
                const data = event.data;
                
                // Check if check-selfie step completed OR loading step started
                // CRITICAL: Catch check-selfie completion IMMEDIATELY, before loading step
                if (data.stepId === 'check-selfie' || 
                    data.stepId === 'loading' ||
                    (data.eventName && data.eventName.includes('selfie')) ||
                    (data.eventName && data.eventName.includes('step')) ||
                    (data.eventName && data.eventName.includes('loading')) ||
                    (data.eventName && data.eventName.includes('complete'))) {
                    
                    console.log('🎯 Detected step event:', data);
                    
                    // NOTE: We NO LONGER redirect from step events
                    // Instead, we intercept the API response and only redirect if verification is approved
                    // This allows failures to be shown normally
                    
                    // Just mark that we've seen the step transition
                    if ((data.stepId === 'check-selfie' || data.stepId === 'loading')) {
                        console.log('⏳ Step transition detected - waiting for verification response...');
                        if (!selfieCheckCompleted) {
                            selfieCheckCompleted = true;
                        }
                        // Don't redirect here - wait for API response interception
                        return; // Don't process further
                    }
                    
                    // For other step events, redirect quickly
                    if (!hasRedirected && !sessionStorage.getItem('liveness_completed')) {
                        setTimeout(() => {
                            if (!hasRedirected && !sessionStorage.getItem('liveness_completed')) {
                                console.log('Redirecting to liveness from step event...');
                                selfieCheckCompleted = true;
                                redirectToLiveness();
                            }
                        }, 200); // Shorter delay
                    }
                }
            }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Also listen for custom events from Ballerine SDK
        document.addEventListener('ballerine:step-complete', messageHandler);
        document.addEventListener('ballerine:step-change', messageHandler);
        
        // MUTATION OBSERVER: Watch for success screen appearing in real-time
        let mutationObserver = null;
        const modal = document.querySelector('[data-ballerine-modal]') || 
                     document.querySelector('.svelte-blow3t');
        
        if (modal) {
            mutationObserver = new MutationObserver((mutations) => {
                const currentModal = document.querySelector('[data-ballerine-modal]') || 
                                   document.querySelector('.svelte-blow3t');
                
                if (currentModal) {
                    const modalText = currentModal.innerText || '';
                    const finalStep = currentModal.querySelector('[data-step-id="final"], [class*="final"], [id*="final"]');
                    const hasSuccessText = modalText.includes('verified') || 
                                          modalText.includes('success') || 
                                          modalText.includes('approved') ||
                                          modalText.includes('Identity verified');
                    
                    // CRITICAL: Only redirect if verification was approved/pending (NOT rejected/error)
                    // Also check for error text in the modal
                    const hasErrorText = modalText.includes('error') || 
                                       modalText.includes('failed') || 
                                       modalText.includes('rejected') ||
                                       modalText.includes('Error sending documents');
                    
                    const lastStatus = sessionStorage.getItem('last_verification_status') || '';
                    const lastMessage = sessionStorage.getItem('last_verification_message') || '';
                    const wasPendingForLiveness = lastStatus === 'pending' && lastMessage.includes('liveness check required');
                    const wasApprovedOrPendingForLiveness = lastStatus === 'approved' || lastStatus === 'success' || lastStatus === 'verified' || wasPendingForLiveness;
                    const wasRejectedOrError = lastStatus === 'rejected' || lastStatus === 'failed' || lastStatus === 'error';
                    
                    // FIX: If verification was rejected but SDK shows success screen, change the text
                    if (finalStep && wasRejectedOrError) {
                        // Check if we need to replace success text
                        const needsReplacement = hasSuccessText && !hasErrorText;
                        
                        if (needsReplacement) {
                            console.log('🔧 FIX: Verification rejected but SDK shows success screen - changing text to failure message');
                            
                            // Get message from storage
                            const lastMessageFromStorage = sessionStorage.getItem('last_verification_message') || '';
                            
                            // Determine failure messages
                            let failureTitle = 'KYC Failed';
                            let failureMessage = 'Face didn\'t match. Please try again.';
                            
                            if (lastMessageFromStorage) {
                                if (lastMessageFromStorage.toLowerCase().includes('face') || lastMessageFromStorage.toLowerCase().includes('match')) {
                                    failureTitle = 'KYC Failed';
                                    failureMessage = 'Face didn\'t match. Please try again.';
                                } else if (lastMessageFromStorage.toLowerCase().includes('unsuccessful')) {
                                    failureTitle = 'Unsuccessful';
                                    // Extract the main message
                                    const msg = lastMessageFromStorage.replace(/^Unsuccessful\s*-?\s*/i, '').trim();
                                    failureMessage = msg || 'Please try again.';
                                } else {
                                    failureTitle = 'KYC Failed';
                                    failureMessage = lastMessageFromStorage || 'Please try again.';
                                }
                            }
                            
                            // Find ALL text elements more aggressively
                            const allElements = finalStep.querySelectorAll('*');
                            let replacedCount = 0;
                            
                            allElements.forEach(el => {
                                // Skip if already processed or empty
                                if (el.dataset.fixedText || !el.textContent) return;
                                
                                const text = el.textContent.trim();
                                const lowerText = text.toLowerCase();
                                
                                // Check if this element contains success text
                                if (lowerText.includes('verified') || 
                                    lowerText.includes('success') || 
                                    lowerText.includes('approved') ||
                                    lowerText.includes('identity verified') ||
                                    lowerText.includes('successfully verified')) {
                                    
                                    // Mark as processed
                                    el.dataset.fixedText = 'true';
                                    
                                    // Replace text based on element type
                                    if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3') {
                                        el.textContent = failureTitle;
                                        replacedCount++;
                                    } else if (el.tagName === 'P' || el.tagName === 'SPAN' || el.tagName === 'DIV') {
                                        // Only replace if it's the main message, not nested elements
                                        const parentTag = el.parentElement?.tagName;
                                        if (parentTag === 'P' || parentTag === 'DIV' || !el.children.length) {
                                            el.textContent = failureMessage;
                                            replacedCount++;
                                        }
                                    }
                                    
                                    // Apply error styling
                                    el.style.color = '#c62828';
                                    el.style.fontWeight = 'bold';
                                    
                                    console.log(`✅ Changed text: "${text.substring(0, 50)}..." → "${el.textContent}"`);
                                }
                            });
                            
                            // Also change icons
                            const icons = finalStep.querySelectorAll('[class*="success"], [class*="check"], [class*="checkmark"], svg');
                            icons.forEach(icon => {
                                const iconText = icon.textContent || '';
                                if (iconText.includes('✓') || iconText.includes('✔') || iconText.includes('check')) {
                                    icon.textContent = '✗';
                                    icon.style.color = '#c62828';
                                    icon.style.background = '#ffebee';
                                    replacedCount++;
                                }
                            });
                            
                            // Change button text if it says "Next" or "Continue"
                            const buttons = finalStep.querySelectorAll('button, [role="button"]');
                            buttons.forEach(btn => {
                                const btnText = btn.textContent.trim().toLowerCase();
                                if (btnText === 'next' || btnText === 'continue') {
                                    btn.textContent = 'Try Again';
                                    replacedCount++;
                                }
                            });
                            
                            console.log(`✅ Text replacement complete: ${replacedCount} elements changed`);
                        }
                        
                        // Prevent redirect to liveness for rejected verifications
                        if (!hasRedirected && !sessionStorage.getItem('liveness_completed')) {
                            console.log('❌ Verification REJECTED - NOT redirecting to liveness');
                            return;
                        }
                    }
                    
                    // Only redirect if verification was approved/pending (NOT rejected/error)
                    if (hasRedirected || sessionStorage.getItem('liveness_completed')) {
                        return;
                    }
                    
                    // Only redirect if:
                    // 1. We see success screen
                    // 2. NO error text is present
                    // 3. Liveness not completed
                    // 4. Verification was approved OR pending for liveness (not rejected/error or pending for other reasons)
                    // 5. We haven't already redirected
                    if (finalStep && hasSuccessText && !hasErrorText && !sessionStorage.getItem('liveness_completed') && !hasRedirected && wasApprovedOrPendingForLiveness && !wasRejectedOrError) {
                        console.log('🚨🚨🚨 MUTATION OBSERVER CRITICAL: Success screen detected (verified as approved/pending, no errors) - redirecting to liveness NOW...');
                        
                        hasRedirected = true;
                        sessionStorage.setItem('kyc_flow_active', 'true');
                        sessionStorage.setItem('kyc_return_url', window.location.href.split('?')[0]);
                        sessionStorage.setItem('kyc_flow_name', 'my-kyc-flow');
                        
                        // Stop everything and redirect IMMEDIATELY
                        if (typeof window.stop === 'function') {
                            window.stop();
                        }
                        window.location.replace('/liveness.html');
                        
                        if (mutationObserver) mutationObserver.disconnect();
                        return;
                    } else if (hasErrorText || wasRejectedOrError) {
                        console.log('❌ MUTATION OBSERVER: Error/rejection detected - NOT redirecting to liveness');
                        return; // Don't redirect on errors
                    }
            }
            });
            
            // Observe the modal for ANY changes
            mutationObserver.observe(modal, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: false
            });
            
            console.log('✅ MutationObserver active - watching for success screen');
        }
        
        // Monitor DOM for step transitions - more aggressive detection
        // Also includes text replacement polling as backup
        const pollInterval = setInterval(() => {
            if (hasRedirected || sessionStorage.getItem('liveness_completed')) {
                clearInterval(pollInterval);
                if (mutationObserver) mutationObserver.disconnect();
                return;
            }
            
            const currentModal = document.querySelector('[data-ballerine-modal]') || 
                        document.querySelector('.svelte-blow3t');
            
            if (currentModal) {
                // Method 0: CRITICAL - Check for success screen FIRST (highest priority)
                // This must be checked BEFORE anything else to catch it immediately
                const finalStep = currentModal.querySelector('[data-step-id="final"], [class*="final"], [id*="final"]');
                const modalText = currentModal.innerText || '';
                const hasSuccessText = modalText.includes('verified') || 
                                      modalText.includes('success') || 
                                      modalText.includes('approved') ||
                                      modalText.includes('Identity verified') ||
                                      modalText.includes('successfully verified');
                
                // Check verification status
                const lastStatus = sessionStorage.getItem('last_verification_status') || '';
                const lastMessage = sessionStorage.getItem('last_verification_message') || '';
                const wasRejectedOrError = lastStatus === 'rejected' || lastStatus === 'failed' || lastStatus === 'error';
                
                // POLLING FIX: Replace success text if verification was rejected (backup to MutationObserver)
                if (finalStep && wasRejectedOrError && hasSuccessText) {
                    const hasErrorText = modalText.includes('error') || 
                                       modalText.includes('failed') || 
                                       modalText.includes('rejected') ||
                                       modalText.includes('kyc failed') ||
                                       modalText.includes('unsuccessful') ||
                                       modalText.includes('face didn\'t match');
                    
                    if (!hasErrorText) {
                        // Don't check dataset flag - try to replace every time until it works
                        console.log('🔧 POLLING FIX: Verification rejected - replacing success text...', {
                            lastStatus,
                            lastMessage,
                            modalText: modalText.substring(0, 100)
                        });
                        
                        // Get failure messages
                        let failureTitle = 'KYC Failed';
                        let failureMessage = 'Face didn\'t match. Please try again.';
                        
                        if (lastMessage) {
                            if (lastMessage.toLowerCase().includes('face') || lastMessage.toLowerCase().includes('match')) {
                                failureTitle = 'KYC Failed';
                                failureMessage = 'Face didn\'t match. Please try again.';
                            } else if (lastMessage.toLowerCase().includes('unsuccessful')) {
                                failureTitle = 'Unsuccessful';
                                const msg = lastMessage.replace(/^Unsuccessful\s*-?\s*/i, '').trim();
                                failureMessage = msg || 'Please try again.';
                            }
                        }
                        
                        // Replace ALL text elements aggressively
                        const allElements = finalStep.querySelectorAll('*');
                        let replacedCount = 0;
                        
                        allElements.forEach(el => {
                            if (el.dataset.fixedText === 'true') return; // Skip already fixed
                            
                            const text = (el.textContent || el.innerText || '').trim();
                            const lowerText = text.toLowerCase();
                            
                            // Check if contains success words
                            if (lowerText.includes('verified') || 
                                lowerText.includes('success') || 
                                lowerText.includes('approved') ||
                                lowerText.includes('identity verified') ||
                                lowerText.includes('successfully verified') ||
                                lowerText === 'success') {
                                
                                // Replace based on element type
                                if (el.tagName.match(/^H[1-6]$/)) {
                                    el.textContent = failureTitle;
                                    el.style.color = '#c62828';
                                    el.style.fontWeight = 'bold';
                                    el.dataset.fixedText = 'true';
                                    replacedCount++;
                                    console.log(`✅ Replaced H tag: "${text}" → "${failureTitle}"`);
                                } else if (el.children.length === 0 && (el.tagName === 'P' || el.tagName === 'SPAN' || el.tagName === 'DIV')) {
                                    // Only replace leaf nodes to avoid nested issues
                                    el.textContent = failureMessage;
                                    el.style.color = '#c62828';
                                    el.style.fontWeight = 'bold';
                                    el.dataset.fixedText = 'true';
                                    replacedCount++;
                                    console.log(`✅ Replaced text: "${text.substring(0, 50)}" → "${failureMessage}"`);
                                }
                            }
                        });
                        
                        // Also replace text nodes directly (more aggressive)
                        const walker = document.createTreeWalker(
                            finalStep,
                            NodeFilter.SHOW_TEXT,
                            null,
                            false
                        );
                        
                        let node;
                        while (node = walker.nextNode()) {
                            const text = node.textContent.trim();
                            if (text.toLowerCase().includes('verified') || 
                                text.toLowerCase().includes('success') || 
                                text.toLowerCase().includes('approved')) {
                                
                                // Check parent element
                                const parent = node.parentElement;
                                if (parent && !parent.dataset.fixedText) {
                                    if (parent.tagName.match(/^H[1-6]$/)) {
                                        parent.textContent = failureTitle;
                                        parent.style.color = '#c62828';
                                        parent.style.fontWeight = 'bold';
                                        parent.dataset.fixedText = 'true';
                                        replacedCount++;
                                    } else if (parent.tagName === 'P' || parent.tagName === 'SPAN') {
                                        parent.textContent = failureMessage;
                                        parent.style.color = '#c62828';
                                        parent.style.fontWeight = 'bold';
                                        parent.dataset.fixedText = 'true';
                                        replacedCount++;
                                    }
                                }
                            }
                        }
                        
                        // Replace buttons
                        finalStep.querySelectorAll('button, [role="button"], a[class*="button"]').forEach(btn => {
                            const btnText = btn.textContent.trim().toLowerCase();
                            if (btnText === 'next' || btnText === 'continue') {
                                btn.textContent = 'Try Again';
                                replacedCount++;
                                console.log('✅ Changed button text to "Try Again"');
                            }
                        });
                        
                        if (replacedCount > 0) {
                            console.log(`✅ POLLING: Text replacement complete - ${replacedCount} elements changed`);
                        } else {
                            console.warn('⚠️ POLLING: No elements replaced - may need different selectors');
                        }
                    }
                }
                
                // CRITICAL: Only redirect if verification was approved/pending (NOT rejected/error)
                // Also check for error text in the modal
                const hasErrorTextPolling = modalText.includes('error') || 
                                   modalText.includes('failed') || 
                                   modalText.includes('rejected') ||
                                   modalText.includes('Error sending documents');
                
                const lastStatusPolling = sessionStorage.getItem('last_verification_status') || '';
                const lastMessagePolling = sessionStorage.getItem('last_verification_message') || '';
                const wasPendingForLivenessPolling = lastStatusPolling === 'pending' && lastMessagePolling.includes('liveness check required');
                const wasApprovedOrPendingForLivenessPolling = lastStatusPolling === 'approved' || lastStatusPolling === 'success' || lastStatusPolling === 'verified' || wasPendingForLivenessPolling;
                const wasRejectedOrErrorPolling = lastStatusPolling === 'rejected' || lastStatusPolling === 'failed' || lastStatusPolling === 'error';
                
                // Only redirect if:
                // 1. We see success screen
                // 2. NO error text is present
                // 3. Liveness not completed  
                // 4. Verification was approved OR pending for liveness (not rejected/error or pending for other reasons)
                // 5. We haven't already redirected
                if (finalStep && hasSuccessText && !hasErrorTextPolling && !sessionStorage.getItem('liveness_completed') && !hasRedirected && wasApprovedOrPendingForLivenessPolling && !wasRejectedOrErrorPolling) {
                    console.log('🚨🚨🚨 POLLING CRITICAL: Success screen detected (verified as approved/pending, no errors) - redirecting to liveness IMMEDIATELY...');
                    
                    hasRedirected = true;
                    sessionStorage.setItem('kyc_flow_active', 'true');
                    sessionStorage.setItem('kyc_return_url', window.location.href.split('?')[0]);
                    sessionStorage.setItem('kyc_flow_name', 'my-kyc-flow');
                    
                    // Stop all execution and redirect IMMEDIATELY
                    if (typeof window.stop === 'function') {
                        window.stop();
                    }
                    window.location.replace('/liveness.html');
                    
                    clearInterval(pollInterval);
                    clearInterval(blankScreenCheck);
                    if (mutationObserver) mutationObserver.disconnect();
                    return;
                }
                
                // Method 1: Check if check-selfie step is visible OR no longer visible (catch it early)
                const checkSelfieStep = modal.querySelector('[data-step-id="check-selfie"], [class*="check-selfie"], [id*="check-selfie"]');
                const selfieStep = modal.querySelector('[data-step-id="selfie"], [class*="selfie"], [id*="selfie"]');
                const loadingStep = modal.querySelector('[data-step-id="loading"], [class*="loading"], [id*="loading"]');
                
                // NOTE: We NO LONGER redirect from check-selfie visibility
                // Instead, we intercept the API response and only redirect if verification is approved
                // This allows failures to be shown normally
                
                // Just mark that we've seen check-selfie for logging
                if (checkSelfieStep && !selfieCheckCompleted) {
                    const checkSelfieVisible = window.getComputedStyle(checkSelfieStep).display !== 'none';
                    if (checkSelfieVisible) {
                        console.log('⏳ check-selfie step visible - waiting for verification response...');
                        // Don't redirect here - wait for API response interception
                    }
                }
                
                // Method 2: Look for loading indicators or loading step text
                const loadingElements = modal.querySelectorAll('[class*="loading"], [class*="step-loading"], [class*="spinner"], [class*="loader"]');
                const loadingText = (modal.innerText || '').toLowerCase();
                const hasLoadingText = loadingText.includes('loading') || loadingText.includes('verifying') || loadingText.includes('processing');
                
                // Method 3: Check if modal content changed significantly (blank screen might mean transition)
                const isBlank = modalText.trim().length < 10 && modalText.length > 0;
                
                // CRITICAL: Only redirect if verification was approved/pending (NOT rejected/error)
                // Also check for error text in the modal
                const hasErrorTextFallback = modalText.includes('error') || 
                                   modalText.includes('failed') || 
                                   modalText.includes('rejected') ||
                                   modalText.includes('Error sending documents');
                
                const lastStatusFallback = sessionStorage.getItem('last_verification_status') || '';
                const lastMessageFallback = sessionStorage.getItem('last_verification_message') || '';
                const wasPendingForLivenessFallback = lastStatusFallback === 'pending' && lastMessageFallback.includes('liveness check required');
                const wasApprovedOrPendingForLivenessFallback = lastStatusFallback === 'approved' || lastStatusFallback === 'success' || lastStatusFallback === 'verified' || wasPendingForLivenessFallback;
                const wasRejectedOrErrorFallback = lastStatusFallback === 'rejected' || lastStatusFallback === 'failed' || lastStatusFallback === 'error';
                
                // Only redirect if verification was approved OR pending for liveness, no errors, and not rejected
                if (finalStep && hasSuccessText && !hasErrorTextFallback && !sessionStorage.getItem('liveness_completed') && !hasRedirected && wasApprovedOrPendingForLivenessFallback && !wasRejectedOrErrorFallback) {
                    console.log('🚨🚨🚨 FALLBACK CRITICAL: Success screen detected (verified as approved/pending, no errors) - STOPPING and redirecting IMMEDIATELY...');
                    
                    // Set flags and redirect IMMEDIATELY (synchronous)
                    selfieCheckCompleted = true;
                    hasRedirected = true;
                    sessionStorage.setItem('kyc_flow_active', 'true');
                    sessionStorage.setItem('kyc_return_url', window.location.href.split('?')[0]);
                    sessionStorage.setItem('kyc_flow_name', 'my-kyc-flow');
                    
                    // Stop all execution and redirect IMMEDIATELY
                    if (typeof window.stop === 'function') {
                        window.stop();
                    }
                    window.location.replace('/liveness.html');
                    
                    // Stop all polling
                    clearInterval(pollInterval);
                    clearInterval(blankScreenCheck);
                    if (mutationObserver) mutationObserver.disconnect();
                    return; // Exit early
                }
                
                // If we see final step with rejection/error text, do nothing - let SDK show error
                const hasErrorText = modalText.includes('failed') || 
                                   modalText.includes('rejected') || 
                                   modalText.includes('error') ||
                                   modalText.includes('Face verification failed');
                if (finalStep && hasErrorText) {
                    console.log('❌ Error/rejection screen detected - NOT redirecting (allowing SDK to show error)');
                    // Don't redirect - let SDK show the error
                }
                
                // NOTE: We NO LONGER redirect from loading step detection
                // Instead, we intercept the API response and only redirect if verification is approved
                // This allows failures to be shown normally
                
                // Only detect loading step for logging purposes
                if (loadingStep || (loadingElements.length > 0 && hasLoadingText)) {
                    if (!selfieCheckCompleted) {
                        console.log('⏳ Loading step detected - waiting for verification response...');
                        selfieCheckCompleted = true; // Mark that we've seen loading
                        // Don't redirect here - wait for API response interception
                    }
                }
                
                // Fallback: If check-selfie and selfie are both gone, or blank screen after selfie
                if ((!checkSelfieStep && !selfieStep && selfieStep !== null && !loadingStep) || 
                    (isBlank && selfieCheckCompleted === false)) {
                    
                    // Small delay to confirm transition
                    if (!selfieCheckCompleted) {
                        console.log('Detected transition from selfie check - redirecting to liveness...');
                        selfieCheckCompleted = true;
                        setTimeout(() => {
                            if (!hasRedirected) {
                                redirectToLiveness();
                            }
                        }, 300);
                    }
                }
            }
        }, 50); // Check EXTREMELY frequently (every 50ms) to catch success screen ASAP
        
        // Also check for blank screen immediately and periodically
        if (checkForBlankScreen()) {
            return; // Already redirected
        }
        
        // Check for blank screen periodically
        const blankScreenCheck = setInterval(() => {
            if (hasRedirected || sessionStorage.getItem('liveness_completed')) {
                clearInterval(blankScreenCheck);
                return;
            }
            
            if (checkForBlankScreen()) {
                clearInterval(blankScreenCheck);
                clearInterval(pollInterval);
            }
        }, 500);
        
        // Stop polling after 2 minutes (timeout)
        setTimeout(() => {
            clearInterval(pollInterval);
            clearInterval(blankScreenCheck);
            if (mutationObserver) mutationObserver.disconnect();
        }, 120000);
        
        flowMonitor = true;
    }
    
    // Redirect to liveness check
    function redirectToLiveness() {
        if (hasRedirected) {
            console.log('Already redirected, ignoring duplicate call');
            return;
        }
        hasRedirected = true;
        
        // Mark that we're in KYC flow
        sessionStorage.setItem('kyc_flow_active', 'true');
        sessionStorage.setItem('kyc_return_url', window.location.href.split('?')[0]);
        sessionStorage.setItem('kyc_flow_name', 'my-kyc-flow');
        
        console.log('🔄 Redirecting to liveness check NOW...');
        console.log('Current URL:', window.location.href);
        
        // Use replace() for immediate, forceful redirect (prevents back button)
        // This is more reliable than href when SDK might be interfering
        window.location.replace('/liveness.html');
        
        // If replace doesn't work immediately, try href as fallback
        setTimeout(() => {
            if (window.location.pathname !== '/liveness.html') {
                console.warn('replace() didn\'t work, trying href...');
                window.location.href = '/liveness.html';
            }
        }, 10);
    }
    
    // Emergency blank screen handler - if user sees blank screen, redirect
    function checkForBlankScreen() {
        const modal = document.querySelector('[data-ballerine-modal]') || 
                     document.querySelector('.svelte-blow3t');
        
        if (modal && !hasRedirected && !sessionStorage.getItem('liveness_completed')) {
            const modalText = (modal.innerText || '').trim();
            const modalVisible = window.getComputedStyle(modal).display !== 'none';
            
            // If modal is visible but has very little content, it might be blank screen
            if (modalVisible && modalText.length < 20 && modalText.length > 0) {
                console.warn('⚠️ Blank screen detected, redirecting to liveness...');
                redirectToLiveness();
                return true;
            }
        }
        return false;
    }
    
    // Intercept network requests IMMEDIATELY (before SDK initializes)
    interceptVerifyRequest();
    
    // Check on page load
    if (!checkLivenessStatus()) {
        // Only start monitoring if we're not returning from liveness
        setTimeout(() => {
            startFlowMonitoring();
        }, 2000); // Wait for SDK to initialize
    } else {
        // If returning from liveness, don't intercept (let verification proceed)
        // Remove interception
        console.log('Liveness completed - verification can proceed');
    }
    
    // Export function for manual trigger (if needed)
    window.redirectToLiveness = redirectToLiveness;
    window.checkForBlankScreen = checkForBlankScreen;
    
    // Auto-check for blank screen on page visibility change
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !hasRedirected) {
            setTimeout(checkForBlankScreen, 500);
        }
    });
    
    console.log('KYC Flow Integration: Liveness redirect handler ready');
    console.log('💡 If you see a blank screen after selfie, run: window.redirectToLiveness()');
})();

