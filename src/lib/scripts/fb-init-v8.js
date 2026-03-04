/**
 * HTML5STUDIO Handshake Recovery v1.0 (Meta SDK v8.0)
 * Ensures Zero-Friction launch & SDK persistence
 */
(function() {
    window.FB_INSTANT_READY = false;

    // 1. Force SDK Load
    var script = document.createElement('script');
    script.src = "https://connect.facebook.net/en_US/fbinstant.8.0.js";
    script.onload = function() {
        console.log("HTML5STUDIO: SDK v8.0 Loaded. Starting Handshake...");
        
        // 2. Initialize with Zero Permissions logic
        FBInstant.initializeAsync().then(function() {
            window.FB_INSTANT_READY = true;
            
            // 3. Inform Unity that the platform is ready
            // (Unity will call checkStatus() via JSLIB)
            console.log("HTML5STUDIO: Handshake Verified.");
            
            // 4. Progress Sync: Map Unity loading to FB Loading bar
            window.onUnityLoading = function(progress) {
                FBInstant.setLoadingProgress(progress * 100);
            };
        }).catch(function(err) {
            console.error("HTML5STUDIO: Handshake Recovery Failed", err);
        });
    };
    document.head.appendChild(script);

    // 5. Global Start Trigger (Called by Unity once 'Start' is hit)
    window.HTML5STUDIO_StartGame = function() {
        if (window.FB_INSTANT_READY) {
            FBInstant.startGameAsync().then(function() {
                console.log("HTML5STUDIO: Play Session Active.");
            });
        }
    };
})();
