/**
 * HTML5STUDIO TikTok Bridge
 * Automatically forces standard TikTok safe-UX styling to prevent the "Swipe to Exit" conflict.
 */
(function () {
    window.addEventListener('load', function () {
        console.log("HTML5STUDIO: Injecting TikTok UX Overrides");

        // Target Unity canvas element
        const canvasContainers = document.querySelectorAll('canvas');
        canvasContainers.forEach(canvas => {
            canvas.style.setProperty('touch-action', 'none', 'important');
        });

        // Generic mobile safe area
        document.body.style.paddingTop = 'env(safe-area-inset-top)';

        // Notify TikTok Bridge if present
        if (typeof tt !== 'undefined') {
            if (tt.onShow) {
                tt.onShow(() => console.log("HTML5STUDIO: TikTok Session Foregrounded."));
            }
        } else {
            console.log("HTML5STUDIO: Local TikTok Simulation");
        }
    });
})();
