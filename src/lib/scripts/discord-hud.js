/**
 * HTML5STUDIO Discord Diagnostic Overlay v1.0
 * For use in $145 Basic Compliance Scan
 */
(function () {
    // Avoid double-injection
    if (window.__H5S_DISCORD_OVERLAY__) return;
    window.__H5S_DISCORD_OVERLAY__ = true;

    const overlay = document.createElement('div');
    overlay.id = 'h5s-discord-overlay';
    overlay.style = `
        position: fixed; top: 0; right: 0; width: 300px; height: 100vh;
        background: rgba(0, 0, 0, 0.9); color: #00ff00; font-family: 'Courier New', monospace;
        font-size: 12px; z-index: 999999; padding: 15px; border-left: 2px solid #5865F2;
        pointer-events: none; overflow-y: auto; display: flex; flex-direction: column;
    `;

    overlay.innerHTML = `
        <div style="color: #ff0000; font-weight: bold; margin-bottom: 10px;">⚠️ DISCORD PERMISSION SPLIT ALERT</div>
        <div id="h5s-discord-log"></div>
        <div style="margin-top: auto; padding-top: 15px; border-top: 1px solid #444;">
            <p style="color: #fff;">Status: <span id="h5s-discord-status">MONITORING</span></p>
            <div style="background: #5865F2; color: #fff; padding: 10px; text-align: center; font-weight: bold; pointer-events: auto; cursor: pointer;" 
                 onclick="window.open('https://www.fiverr.com/YOUR_GIG_LINK', '_blank')">
                 UPGRADE TO CERTIFIED (SDK 1.8)
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const logContainer = document.getElementById('h5s-discord-log');

    function addLog(msg, level = 'info') {
        const entry = document.createElement('div');
        entry.style.marginBottom = '5px';
        entry.style.color = level === 'critical' ? '#ff0000' : (level === 'warn' ? '#ffff00' : '#00ff00');
        entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logContainer.prepend(entry);
    }

    // Proxy the sdk.commands.authorize to catch legacy broad scopes
    const checkDiscordScopes = () => {
        if (window.discordSdk && window.discordSdk.commands) {
            const origAuthorize = window.discordSdk.commands.authorize;
            window.discordSdk.commands.authorize = async function (args) {
                if (args && args.scope) {
                    const scopes = typeof args.scope === 'string' ? args.scope : args.scope.join(' ');
                    if (scopes.includes('MANAGE_GUILD') || scopes.includes('MANAGE_MESSAGES')) {
                        addLog('CRITICAL: Legacy broad scope detected (MANAGE_GUILD/MESSAGES). Authorization will likely fail.', 'critical');
                        document.getElementById('h5s-discord-status').innerText = 'PERMISSION BLOCKED';
                        document.getElementById('h5s-discord-status').style.color = '#ff0000';
                    } else {
                        addLog(`Auth Scopes OK: ${scopes}`, 'info');
                    }
                }
                return origAuthorize.apply(window.discordSdk.commands, arguments);
            };
            addLog("Hooked Discord SDK Authorization", "info");
        } else {
            setTimeout(checkDiscordScopes, 1000);
        }
    };

    checkDiscordScopes();
})();
