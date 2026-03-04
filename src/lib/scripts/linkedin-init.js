/**
 * HTML5STUDIO LinkedIn Native Security Bridge (Zero-PII)
 * Stubs window.fetch and XMLHttpRequest to drop outbound payload transmission to known analytics endpoints without game logic crashing.
 */
(function () {
    console.log("HTML5STUDIO: LinkedIn Security Bridge Initialize (Zero-PII)");

    const blockedDomains = [
        "google-analytics.com",
        "googletagmanager.com",
        "facebook.com/tr",
        "hotjar.com",
        "linkedin.com/px" // Native linkedin tracker also blocked for B2B compliance
    ];

    function isBlockedUrl(url) {
        if (!url) return false;
        if (typeof url !== 'string') return false;

        const lowerUrl = url.toLowerCase();
        for (let i = 0; i < blockedDomains.length; i++) {
            if (lowerUrl.includes(blockedDomains[i])) {
                return true;
            }
        }
        return false;
    }

    // 1. Stub Fetch
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const url = args[0] && typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : "");

        if (isBlockedUrl(url)) {
            console.warn("HTML5STUDIO: Security Bridge blocked outbound fetch payload to -> " + url);
            // Return a dummy 200 OK so the tracking scripts don't throw terminal errors
            return new Response('{}', { status: 200, statusText: "OK (Blocked)" });
        }
        return originalFetch.apply(this, args);
    };

    // 2. Stub XMLHttpRequest
    const originalXHR = window.XMLHttpRequest;
    function CustomXHR() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;

        xhr.open = function (method, url, ...rest) {
            this._interceptedUrl = url;
            if (isBlockedUrl(url)) {
                // Modify the URL to a local stub, or just let send() abort it
                this._isBlocked = true;
            }
            return originalOpen.apply(this, [method, url, ...rest]);
        };

        const originalSend = xhr.send;
        xhr.send = function (body) {
            if (this._isBlocked) {
                console.warn("HTML5STUDIO: Security Bridge blocked outbound XHR payload to -> " + this._interceptedUrl);
                // Simulate rapid success
                Object.defineProperty(this, 'readyState', { value: 4, writable: false });
                Object.defineProperty(this, 'status', { value: 200, writable: false });
                Object.defineProperty(this, 'responseText', { value: '{}', writable: false });

                if (this.onreadystatechange) {
                    this.onreadystatechange();
                }
                if (this.onload) {
                    this.onload();
                }
                return;
            }
            return originalSend.apply(this, [body]);
        };

        return xhr;
    }
    window.XMLHttpRequest = CustomXHR;

})();
