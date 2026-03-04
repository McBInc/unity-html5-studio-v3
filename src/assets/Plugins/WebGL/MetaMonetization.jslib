mergeInto(LibraryManager.library, {
    ReportValueAction: function (actionType, value) {
        var action = UTF8ToString(actionType);
        
        // 2026 CMP Logic: Logging value events to the Performance Payout dashboard
        // This informs Meta that the user is highly engaged, increasing the "Performance Score"
        FBInstant.setSessionData({
            last_action: action,
            action_value: value,
            timestamp: Date.now()
        });
        
        console.log("HTML5STUDIO: Value Action Reported -> " + action);
    },

    TriggerPerformanceAd: function () {
        // High-Yield 2026 Video Implementation
        FBInstant.getRewardedVideoAsync('YOUR_PLACEMENT_ID').then(function(ad) {
            return ad.loadAsync().then(function() {
                return ad.showAsync();
            });
        }).then(function() {
            // Success: Reward the player and the CMP algorithm logs the high-intent view
            SendMessage('GameManager', 'OnAdSuccess');
        }).catch(function(err) {
            console.error("HTML5STUDIO: Ad Logic Failed", err.message);
        });
    }
});
