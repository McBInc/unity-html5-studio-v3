mergeInto(LibraryManager.library, {
    TelegramStarsPurchase: function (invoiceUrlPtr) {
        var invoiceUrl = UTF8ToString(invoiceUrlPtr);
        
        // Map the call to the HTML5Studio injected engine
        if (typeof window !== 'undefined' && window.HTML5StudioTelegram && window.HTML5StudioTelegram.purchaseStars) {
            window.HTML5StudioTelegram.purchaseStars(invoiceUrl);
        } else {
            console.warn("[TelegramPayment.jslib] HTML5Studio Telegram Bridge not found! Is the WebApp SDK injected?");
        }
    }
});
