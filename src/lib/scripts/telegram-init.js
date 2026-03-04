/**
 * Telegram Web App Bridge
 * Injected automatically by HTML5Studio Engine for TELEGRAM deployments
 */

(function () {
    // 1. Await window window.Telegram bindings
    window.addEventListener("load", function () {
        if (window.Telegram && window.Telegram.WebApp) {
            // Log to Unity Debug Console (if mapped)
            console.log("[HTML5Studio] Telegram Web App SDK Detected. Calling ready()");

            const tg = window.Telegram.WebApp;

            // Let Telegram know the app is fully loaded
            tg.ready();

            // 2. Expand viewport - Mini Apps start boxed inside a sheet. 
            // This forces WebGL Unity to go full screen immediately.
            if (!tg.isExpanded) {
                console.log("[HTML5Studio] Requesting Viewport Expansion");
                tg.expand();
            }

            // 3. Patch window.open (Unity Application.OpenURL) 
            // Mini apps block standard target="_blank" redirects. We must use WebApp.openLink
            const originalOpen = window.open;
            window.open = function (url, target, features) {
                if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
                    console.log("[HTML5Studio] Intercepting window.open to tg.openLink:", url);
                    tg.openLink(url);
                    return null;
                }
                return originalOpen.apply(this, arguments);
            };

            // 4. Map the `.jslib` Stars Payment requests back to the Telegram Web App
            window.HTML5StudioTelegram = {
                purchaseStars: function (invoiceUrl) {
                    console.log("[HTML5Studio] Unity invoked Telegram Stars Purchase:", invoiceUrl);
                    tg.openInvoice(invoiceUrl, function (status) {
                        console.log("[HTML5Studio] Telegram Stars Purchase Status:", status);
                    });
                }
            };
        } else {
            console.warn("[HTML5Studio] Telegram Web App SDK not found on window!");
        }
    });
})();
