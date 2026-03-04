/**
 * HTML5STUDIO YouTube Playables Wrapper
 * Connects Unity's SendMessage up to YouTube's Pause/Resume hooks.
 */
(function () {
    window.YT_PLAYABLE_READY = false;

    // The Unity Instance ref needs to be bound so we can call Unity's pause/resume
    let unityGameInstance = null;

    // Intercept when createUnityInstance resolves
    const originalCreateUnityInstance = window.createUnityInstance;
    if (originalCreateUnityInstance) {
        window.createUnityInstance = async function () {
            const instance = await originalCreateUnityInstance.apply(this, arguments);
            unityGameInstance = instance;
            return instance;
        };
    } else {
        // Simple polling fallback for old templates
        const findInstance = setInterval(() => {
            if (window.unityInstance || window.gameInstance) {
                unityGameInstance = window.unityInstance || window.gameInstance;
                clearInterval(findInstance);
            }
        }, 500);
    }

    // Attempt to pull the globally injected YT Playables SDK
    if (typeof window.ytGame === 'undefined') {
        console.error("HTML5STUDIO: window.ytGame not found. Injecting script...");
        var script = document.createElement('script');
        script.src = "//www.youtube.com/iframe_api"; // Placeholder for actual sdk if needed, doc assumes it's injected by YouTube
        // YouTube playables documentation instructs devs to await youtube hooks.
    }

    async function setupYTSdk() {
        if (!window.ytGame) return setTimeout(setupYTSdk, 250);

        try {
            await window.ytGame.ready();
            window.YT_PLAYABLE_READY = true;
            console.log("HTML5STUDIO: YouTube Playables SDK Active.");

            // Mark the game as fully ready to the platform so the loading screen drops
            window.ytGame.sendScore = function (score) { } // polyfill
            window.ytGame.gameReady();

            // Bind YouTube's Pause/Resume events to the Unity Engine
            window.ytGame.onPause(() => {
                if (unityGameInstance) {
                    unityGameInstance.SendMessage('YTGameWrapper', 'OnYouTubePause');
                }
            });

            window.ytGame.onResume(() => {
                if (unityGameInstance) {
                    unityGameInstance.SendMessage('YTGameWrapper', 'OnYouTubeResume');
                }
            });

        } catch (e) {
            console.error("HTML5STUDIO: YouTube Handshake Failed", e);
        }
    }

    // We start polling for `ytGame`
    setupYTSdk();
})();
