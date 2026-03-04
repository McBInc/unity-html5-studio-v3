mergeInto(LibraryManager.library, {
    OpenDiscordPurchase: function (skuId) {
        var sku = UTF8ToString(skuId);
        
        // Ensure discordSdk is available globally
        if (typeof window.discordSdk !== 'undefined' && window.discordSdk.commands) {
            // Social SDK 1.6+ Native Commerce Handshake
            window.discordSdk.commands.openPurchaseModal({ sku_id: sku })
                .then(() => {
                    console.log("HTML5STUDIO: Discord Purchase Success -> " + sku);
                    SendMessage('StoreManager', 'OnPurchaseSuccess', sku);
                })
                .catch((err) => {
                    console.error("HTML5STUDIO: Discord SKU Error", err);
                    SendMessage('StoreManager', 'OnPurchaseFailed', sku);
                });
        } else {
            console.error("HTML5STUDIO: Cannot open purchase, discordSdk not ready.");
        }
    }
});
