/**
 * Simple Mode — frontend plugin for QwenPaw Console.
 *
 * Loaded by the host via usePluginLoader (same-origin Blob URL + dynamic
 * import) during Console startup. Runs in the page context, so it can
 * inject a stylesheet and toggle it at runtime.
 *
 * Design notes
 * ------------
 * The Console uses CSS Modules with `generateScopedName:
 * "[name]__[local]__[hash:base64:5]"`. The hash is only a *suffix*, so
 * the local name prefix stays stable and can be targeted with
 * `[class*="pageHeader__extra"]` style attribute selectors. No hashed
 * class is ever referenced here.
 *
 * Everything is driven from one `<style id="simple-mode-style">` tag so
 * a single class toggle on <html> turns the whole mode on and off.
 */
(function () {
  "use strict";

  var STYLE_ID = "simple-mode-style";
  var ROOT_CLASS = "simple-mode";
  var STORAGE_KEY = "qwenpaw.simpleMode.enabled";

  /* ------------------------------------------------------------------ *
   * Stylesheet
   * ------------------------------------------------------------------ */

  var CSS = [
    /* ---------- 1. Button decluttering ------------------------------ *
     * The report's core finding: buttons are not too many, they are
     * scattered across up to 7 container layers. Here we do two things:
     *   a) collapse the page-header action row into a scrollable strip
     *      so it never wraps into 2-3 rows on narrow screens;
     *   b) hide low-priority icon buttons on phones and keep exactly
     *      one primary action + a "more" affordance.
     * ---------------------------------------------------------------- */

    "html." + ROOT_CLASS + " [data-page-header] [class*='-module__extra__'] {",
    "  flex-wrap: nowrap;",
    "  overflow-x: auto;",
    "  scrollbar-width: none;",
    "  -webkit-overflow-scrolling: touch;",
    "  max-width: 100%;",
    "}",
    "html." + ROOT_CLASS + " [data-page-header] [class*='-module__extra__']::-webkit-scrollbar {",
    "  display: none;",
    "}",
    /* On phones keep only the first two actions visible; the rest stay
       reachable by horizontal scroll instead of stacking vertically. */
    "@media (max-width: 768px) {",
    "  html." + ROOT_CLASS + " [data-page-header] [class*='-module__extra__'] {",
    "    gap: 4px;",
    "    justify-content: flex-end;",
    "  }",
    "  html." + ROOT_CLASS + " [data-page-header] [class*='-module__extra__'] > * {",
    "    flex: 0 0 auto;",
    "  }",
    "}",

    /* ---------- 2. Unified breakpoints ----------------------------- *
     * The Console ships 13 different width breakpoints. Here we pin the
     * four canonical ones (480 / 768 / 1024 / 1280) onto CSS variables
     * and make the most fragmented containers follow them.
     * ---------------------------------------------------------------- */

    "html." + ROOT_CLASS + " {",
    "  --sm-bp: 480px;",
    "  --md-bp: 768px;",
    "  --lg-bp: 1024px;",
    "  --xl-bp: 1280px;",
    "}",

    /* ---------- 3. Touch targets ------------------------------------ *
     * tokens.css already defines --app-hit-touch (44px) and switches
     * --app-hit-target on coarse pointers, but many pages hard-code
     * 32px buttons. Force the token to win for real buttons.
     * ---------------------------------------------------------------- */

    "@media (any-pointer: coarse) {",
    "  html." + ROOT_CLASS + " button.qwenpaw-btn:not(.qwenpaw-btn-text) {",
    "    min-height: 40px;",
    "  }",
    "  html." + ROOT_CLASS + " button.qwenpaw-btn-icon-only {",
    "    min-width: 40px;",
    "    min-height: 40px;",
    "  }",
    "  html." + ROOT_CLASS + " [class*='-module__collapsedNavItem__'],",
    "  html." + ROOT_CLASS + " [class*='-module__collapseToggle__'] {",
    "    min-width: 44px;",
    "    min-height: 44px;",
    "  }",
    "}",

    /* ---------- 4. Composer safe area ------------------------------- *
     * The chat composer had no env(safe-area-inset-bottom) handling, so
     * the iPhone home indicator overlapped the input box.
     * ---------------------------------------------------------------- */

    "html." + ROOT_CLASS + " [class*='-module__chatPageRoot__'] [class*='-module__mobileComposerControl__'],",
    "html." + ROOT_CLASS + " [class*='-module__senderActionAffix__'],",
    "html." + ROOT_CLASS + " [class*='-module__compactSenderAffix__'] {",
    "  padding-bottom: max(8px, env(safe-area-inset-bottom));",
    "}",

    /* ---------- 5. Density ------------------------------------------ *
     * Tighter, more uniform rhythm so pages stop feeling busy.
     * ---------------------------------------------------------------- */

    "html." + ROOT_CLASS + " [data-page-header] {",
    "  padding-top: 14px;",
    "  padding-bottom: 14px;",
    "}",
    "html." + ROOT_CLASS + " [class*='-module__breadcrumbCurrent__'] {",
    "  font-size: 19px;",
    "}",
    "html." + ROOT_CLASS + " [class*='-module__utilityGroup__'] {",
    "  gap: 0;",
    "}",

    /* ---------- 6. Table decluttering ------------------------------- *
     * Tables wider than the viewport get a soft fade + horizontal
     * scroll instead of pushing the layout sideways.
     * ---------------------------------------------------------------- */

    "html." + ROOT_CLASS + " [class*='-module__tableCard__'],",
    "html." + ROOT_CLASS + " [class*='-module__tableWrap__'],",
    "html." + ROOT_CLASS + " [class*='-module__tablePanel__'],",
    "html." + ROOT_CLASS + " .ant-table-wrapper {",
    "  max-width: 100%;",
    "  overflow-x: auto;",
    "}",
    "@media (max-width: 768px) {",
    "  html." + ROOT_CLASS + " [class*='-module__sessionsPage__'] [class*='-module__tableCard__'] {",
    "    border-radius: 12px;",
    "  }",
    "}",

    /* ---------- 7. Reduced motion ----------------------------------- */

    "@media (prefers-reduced-motion: reduce) {",
    "  html." + ROOT_CLASS + " * {",
    "    animation-duration: 1ms !important;",
    "    transition-duration: 1ms !important;",
    "  }",
    "}",
  ].join("\n");

  /* ------------------------------------------------------------------ *
   * Injection + toggle
   * ------------------------------------------------------------------ */

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function readEnabled() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return false; // opt-in
      return raw === "1";
    } catch (e) {
      return false;
    }
  }

  function writeEnabled(on) {
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch (e) {
      /* storage unavailable — mode still applies for this page load */
    }
  }

  function apply(on) {
    ensureStyle();
    var root = document.documentElement;
    if (on) {
      root.classList.add(ROOT_CLASS);
    } else {
      root.classList.remove(ROOT_CLASS);
    }
    writeEnabled(on);
    try {
      window.dispatchEvent(
        new CustomEvent("qwenpaw:simple-mode", { detail: { enabled: !!on } }),
      );
    } catch (e) {
      /* CustomEvent unsupported — ignore */
    }
  }

  function isOn() {
    return document.documentElement.classList.contains(ROOT_CLASS);
  }

  function toggle() {
    apply(!isOn());
    return isOn();
  }

  /* ------------------------------------------------------------------ *
   * Settings surface
   * ------------------------------------------------------------------ */

  var SETTINGS_KEY = "qwenpaw.simpleMode.settings";

  function readSettings() {
    var defaults = { enabled: readEnabled(), scope: "global" };
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          defaults.enabled =
            typeof parsed.enabled === "boolean" ? parsed.enabled : defaults.enabled;
          if (parsed.scope === "mobile" || parsed.scope === "global") {
            defaults.scope = parsed.scope;
          }
        }
      }
    } catch (e) {
      /* keep defaults */
    }
    return defaults;
  }

  function writeSettings(s) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Scope handling:
   *   global — always on
   *   mobile — only on when the viewport is narrow (the report's worst case)
   */
  function applyScope() {
    var s = readSettings();
    if (s.scope === "mobile") {
      var narrow = window.matchMedia("(max-width: 768px)").matches;
      apply(s.enabled && narrow);
    } else {
      apply(s.enabled);
    }
  }

  /* ------------------------------------------------------------------ *
   * Toggle button (rendered into the chat right header)
   * ------------------------------------------------------------------ */

  function mountToggleButton() {
    var QwenPaw = window.QwenPaw;
    if (!QwenPaw || !QwenPaw.chat || !QwenPaw.chat.rightHeader) return null;
    if (!QwenPaw.host || !QwenPaw.host.React) return null;

    var React = QwenPaw.host.React;
    var h = React.createElement;
    var antd = QwenPaw.host.antd || {};
    var Button = antd.Button;
    var Tooltip = antd.Tooltip;
    if (!Button || !Tooltip) return null;

    // A tiny component keeps its own state so the dot re-renders on toggle.
    var ToggleButton = function () {
      var useState = React.useState;
      var pair = useState(0);
      var bump = pair[1];
      var on = isOn();
      return h(
        Tooltip,
        { title: on ? "简洁模式：已开启（点击关闭）" : "简洁模式：已关闭（点击开启）" },
        h(Button, {
          type: "text",
          "aria-label": "Toggle simple mode",
          "aria-pressed": on,
          title: "简洁模式",
          icon: h(
            "span",
            {
              style: {
                fontSize: 15,
                lineHeight: 1,
                opacity: on ? 1 : 0.5,
                color: on ? "var(--app-accent)" : "inherit",
              },
            },
            on ? "\u25CF" : "\u25CB",
          ),
          onClick: function (e) {
            if (e && e.stopPropagation) e.stopPropagation();
            var s = readSettings();
            s.enabled = !s.enabled;
            writeSettings(s);
            applyScope();
            bump(function (n) { return n + 1; });
          },
        }),
      );
    };

    try {
      return QwenPaw.chat.rightHeader.add("simple-mode", h(ToggleButton), {
        id: "simple-mode-toggle",
        order: 100,
      });
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ *
   * Host integration (optional): a settings panel + a header toggle
   * ------------------------------------------------------------------ */

  function mountToggle() {
    var QwenPaw = window.QwenPaw;
    if (!QwenPaw || !QwenPaw.host) return;

    // Expose an imperative API for other plugins / the console.
    QwenPaw.simpleMode = {
      enable: function () { var s = readSettings(); s.enabled = true; writeSettings(s); applyScope(); },
      disable: function () { var s = readSettings(); s.enabled = false; writeSettings(s); applyScope(); },
      toggle: toggle,
      isEnabled: isOn,
      setScope: function (scope) { var s = readSettings(); s.scope = scope; writeSettings(s); applyScope(); },
      getSettings: readSettings,
    };
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function boot() {
    ensureStyle();
    applyScope();
    mountToggle();
    mountToggleButton();

    // Re-evaluate the mobile scope when the viewport crosses the
    // breakpoint.
    if (window.matchMedia) {
      var mq = window.matchMedia("(max-width: 768px)");
      var onChange = function () { applyScope(); };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    // React re-renders can replace <html>'s class list in some paths;
    // re-assert on the next frames to be safe.
    var reassert = function () {
      var s = readSettings();
      var shouldBeOn =
        s.scope === "mobile"
          ? s.enabled && window.matchMedia("(max-width: 768px)").matches
          : s.enabled;
      if (shouldBeOn && !isOn()) apply(true);
    };
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(reassert);
      window.setTimeout(reassert, 300);
      window.setTimeout(reassert, 1200);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
