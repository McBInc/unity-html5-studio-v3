mergeInto(LibraryManager.library, {
    YT_SendScore: function (score) {
        if (typeof window.ytGame !== 'undefined' && window.ytGame.sendScore) {
            window.ytGame.sendScore(score);
            console.log("HTML5STUDIO: Extracted Score to YT -> " + score);
        }
    },
    
    YT_SaveData: function(key, val) {
        // Highscore sync mappings
        if (typeof window.ytGame !== 'undefined') {
             var k = UTF8ToString(key);
             var v = UTF8ToString(val);
             if (window.ytGame.saveData) window.ytGame.saveData(k, v);
        }
    }
});
