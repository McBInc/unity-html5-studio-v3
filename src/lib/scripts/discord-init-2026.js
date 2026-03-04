/**
 * HTML5STUDIO Discord Handshake Recovery v1.8
 * Solves the 2026 "Handshake Reload" bug where Unity loses context on a browser refresh.
 */
(function () {
    window.DISCORD_READY = false;

    // Attempt to pull the globally injected or initialized Discord SDK
    const discordSdk = window.discordSdk || (typeof window.DiscordSDK !== 'undefined' ? new window.DiscordSDK(window.__DISCORD_CLIENT_ID || "DEFAULT_ID") : null);

    if (!discordSdk) {
        console.error("HTML5STUDIO: Discord SDK not found.");
        return;
    }

    async function setup() {
        // Raise timeout from standard 4s to 15s to handle proxy jitter and permission split delays
        const timeout = setTimeout(() => {
            console.error("HTML5STUDIO: Discord Handshake Timeout - Recovering by reloading...");
            location.reload();
        }, 15000);

        try {
            await discordSdk.ready();
            clearTimeout(timeout);

            window.DISCORD_READY = true;
            console.log("HTML5STUDIO: Discord Social SDK 1.8 Active.");
        } catch (e) {
            console.error("HTML5STUDIO: Discord Handshake Failed", e);
            clearTimeout(timeout);
        }
    }

    setup();
})();
