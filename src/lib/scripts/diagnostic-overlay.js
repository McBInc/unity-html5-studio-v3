/**
 * diagnostic-overlay.js
 * Lightweight, zero-click diagnostic HUD for certified live links.
 * - Captures console errors/warns/logs (throttled)
 * - Captures window.onerror + unhandledrejection
 * - Captures resource loading errors (script/wasm/data/css)
 * - Displays key env + last events
 *
 * IMPORTANT:
 * - pointer-events:none so it won't block gameplay
 * - safe to inject into any build; no external dependencies
 */
(function () {
  "use strict";

  // Avoid double-injection
  if (window.__H5S_DIAG_OVERLAY__) return;
  window.__H5S_DIAG_OVERLAY__ = true;

  const MAX_LINES = 120;
  const MAX_LINE_LEN = 600;
  const START_TS = Date.now();

  function clampStr(s) {
    s = String(s ?? "");
    if (s.length > MAX_LINE_LEN) return s.slice(0, MAX_LINE_LEN) + "…";
    return s;
  }

  function fmtTime() {
    const ms = Date.now() - START_TS;
    const sec = (ms / 1000).toFixed(1);
    return `${sec}s`;
  }

  // UI
  const overlay = document.createElement("div");
  overlay.id = "h5s-diag-overlay";
  overlay.style.cssText =
    "position:fixed;top:0;right:0;width:320px;height:100vh;background:rgba(0,0,0,0.92);" +
    "color:#ff4d4d;z-index:999999;padding:12px;font-family:monospace;border-left:2px solid #ff4d4d;" +
    "pointer-events:none;overflow:hidden;";

  const header = document.createElement("div");
  header.style.cssText = "font-weight:bold;color:#ffd6d6;margin-bottom:8px;";
  header.innerHTML = "⚠️ HTML5STUDIO DIAGNOSTICS<br/><span style='font-weight:normal;color:#ff9b9b'>Live runtime logs</span>";

  const meta = document.createElement("div");
  meta.style.cssText = "color:#ff9b9b;font-size:12px;line-height:1.3;margin-bottom:8px;white-space:pre-wrap;";
  meta.textContent = [
    `time: ${new Date().toISOString()}`,
    `url: ${location.href}`,
    `ua: ${navigator.userAgent}`,
    window.HTML5STUDIO?.env?.target ? `target: ${window.HTML5STUDIO.env.target}` : null,
  ].filter(Boolean).join("\n");

  const hr = document.createElement("div");
  hr.style.cssText = "height:1px;background:#ff4d4d;opacity:0.35;margin:8px 0;";

  const logsWrap = document.createElement("div");
  logsWrap.id = "h5s-logs";
  logsWrap.style.cssText =
    "height:calc(100vh - 140px);overflow:hidden;color:#ff4d4d;font-size:12px;line-height:1.25;white-space:pre-wrap;";

  overlay.appendChild(header);
  overlay.appendChild(meta);
  overlay.appendChild(hr);
  overlay.appendChild(logsWrap);

  function ensureMounted() {
    if (document.body && !document.getElementById(overlay.id)) {
      document.body.appendChild(overlay);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureMounted, { once: true });
  } else {
    ensureMounted();
  }

  const lines = [];

  function addLine(level, msg, extra) {
    const t = fmtTime();
    const line = `[${t}] ${level}: ${clampStr(msg)}${extra ? " " + clampStr(extra) : ""}`;

    lines.push(line);
    while (lines.length > MAX_LINES) lines.shift();

    // Render (cheap)
    if (logsWrap) {
      logsWrap.textContent = lines.join("\n");
    }
  }

  // Console hook
  const orig = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  function wrapConsole(fnName, level) {
    console[fnName] = function (...args) {
      try {
        const joined = args.map((a) => {
          if (a instanceof Error) return a.stack || a.message;
          if (typeof a === "object") {
            try { return JSON.stringify(a); } catch { return "[object]"; }
          }
          return String(a);
        }).join(" ");

        addLine(level, joined);
      } catch {
        // ignore
      }
      return orig[fnName].apply(console, args);
    };
  }

  wrapConsole("log", "LOG");
  wrapConsole("warn", "WARN");
  wrapConsole("error", "ERROR");

  // Global errors
  window.addEventListener("error", (ev) => {
    try {
      // Resource error (script/css/img/wasm)
      const target = ev.target;
      if (target && target !== window && target.tagName) {
        const tag = target.tagName.toLowerCase();
        const url = target.src || target.href || "";
        addLine("RESOURCE_FAIL", `${tag} failed`, url);
        return;
      }

      const msg = ev.message || "window.error";
      const src = ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : "";
      addLine("UNCAUGHT", msg, src);
    } catch {
      // ignore
    }
  }, true);

  window.addEventListener("unhandledrejection", (ev) => {
    try {
      const reason = ev.reason;
      if (reason instanceof Error) addLine("PROMISE", reason.stack || reason.message);
      else addLine("PROMISE", String(reason));
    } catch {
      // ignore
    }
  });

  // Network-ish: capture failed fetch/XHR
  // Note: we avoid modifying return types; only log failures.
  const origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = async function (...args) {
      try {
        const res = await origFetch.apply(this, args);
        if (!res.ok) addLine("FETCH_FAIL", `${res.status} ${res.statusText}`, safeReqUrl(args));
        return res;
      } catch (e) {
        addLine("FETCH_ERR", String(e), safeReqUrl(args));
        throw e;
      }
    };
  }

  function safeReqUrl(fetchArgs) {
    try {
      const a0 = fetchArgs && fetchArgs[0];
      if (typeof a0 === "string") return a0;
      if (a0 && typeof a0 === "object" && "url" in a0) return String(a0.url);
    } catch {}
    return "";
  }

  // Optional: if universal-init exists, surface its ready/error events
  window.addEventListener("HTML5STUDIO_READY", () => {
    try {
      const t = window.HTML5STUDIO?.env?.target || "unknown";
      addLine("H5S", "universal-init READY", `target=${t}`);
    } catch {}
  });

  window.addEventListener("HTML5STUDIO_ERROR", (e) => {
    addLine("H5S", "universal-init ERROR", "");
  });

  addLine("HUD", "Overlay initialized", "");
})();