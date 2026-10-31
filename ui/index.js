/**
 * Simple Mode — frontend plugin for QwenPaw Console.
 *
 * Loaded by the host's usePluginLoader as an ES module (same-origin Blob
 * URL + dynamic `import()`) during Console startup. Runs in the page
 * context, so it can inject a stylesheet and toggle it at runtime.
 *
 * Design notes
 * ------------
 * The Console uses CSS Modules with `generateScopedName:
 * "[name]__[local]__[hash:base64:5]"`. The hash is only a *suffix*, so
 * the local name prefix stays stable and can be targeted with
 * `[class*="-module__extra__"]` style attribute selectors. No hashed
 * class is ever referenced here.
 *
 * Everything is driven from one `<style id="simple-mode-style">` tag so
 * a single class toggle on <html> turns the whole mode on and off.
 *
 * v0.2.0 restructure
 * ------------------
 * - One settings store (`qwenpaw.simpleMode.settings`) is the single
 *   source of truth; the legacy `qwenpaw.simpleMode.enabled` flag is
 *   only seeded from on first read and mirrored on write (downgrade
 *   compat). The old dual-key read/repair dance is gone.
 * - The stylesheet is one template literal; the duplicated
 *   narrow-screen composer rules of v0.1.1/v0.1.3 are merged (keeping
 *   the values that effectively won the cascade).
 * - Storage is written only on explicit user intent — not on every
 *   resize/reassert. (The old code persisted `enabled=false` whenever
 *   a "mobile"-scoped user resized a desktop window.)
 * - A MutationObserver on <html> re-asserts the wanted state when React
 *   wipes the root class, replacing the rAF/setTimeout timer trio.
 */

const STYLE_ID = "simple-mode-style";
const ROOT_CLASS = "simple-mode";
const SETTINGS_KEY = "qwenpaw.simpleMode.settings";
const LEGACY_ENABLED_KEY = "qwenpaw.simpleMode.enabled";
const EVENT_NAME = "qwenpaw:simple-mode";
const MOBILE_QUERY = "(max-width: 768px)";

const IS_ZH = (navigator.language || "").toLowerCase().startsWith("zh");
const T = IS_ZH
  ? { name: "简洁模式", on: "简洁模式：已开启（点击关闭）", off: "简洁模式：已关闭（点击开启）" }
  : {
      name: "Simple Mode",
      on: "Simple Mode: on (click to turn off)",
      off: "Simple Mode: off (click to turn on)",
    };

/* ------------------------------------------------------------------ *
 * Stylesheet
 * ------------------------------------------------------------------ */

const CSS = /* css */ `
/* ---------- 1. Breakpoint tokens --------------------------------- *
 * The Console ships 13 ad-hoc widths; these pin the four canonical
 * ones (480 / 768 / 1024 / 1280) for this sheet and for any sibling
 * stylesheet that wants to match. Note that @media cannot read
 * custom properties — the media queries below use the same values
 * literally. */

html.${ROOT_CLASS} {
  --sm-bp: 480px;
  --md-bp: 768px;
  --lg-bp: 1024px;
  --xl-bp: 1280px;
}

/* ---------- 2. Page header: action strip + density ---------------- *
 * Buttons are not too many, they are scattered across up to 7
 * container layers. Collapse the header action row into a
 * scrollable strip so it never wraps into 2-3 rows, and tighten the
 * header rhythm so pages stop feeling busy. */

html.${ROOT_CLASS} [data-page-header] [class*="-module__extra__"] {
  flex-wrap: nowrap;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
}

html.${ROOT_CLASS} [data-page-header] [class*="-module__extra__"]::-webkit-scrollbar {
  display: none;
}

/* On phones keep the actions on one line, reachable by horizontal
 * scroll instead of stacking vertically. flex-start (not flex-end)
 * keeps the leftward overflow scrollable — a flex-end scroll
 * container clips its left edge out of reach in LTR. The container
 * shrink-wraps, so alignment inside it does not change the resting
 * look. */
@media (max-width: 768px) {
  html.${ROOT_CLASS} [data-page-header] [class*="-module__extra__"] {
    gap: 4px;
    justify-content: flex-start;
  }

  html.${ROOT_CLASS} [data-page-header] [class*="-module__extra__"] > * {
    flex: 0 0 auto;
  }
}

html.${ROOT_CLASS} [data-page-header] {
  padding-top: 14px;
  padding-bottom: 14px;
}

html.${ROOT_CLASS} [class*="-module__breadcrumbCurrent__"] {
  font-size: 19px;
}

html.${ROOT_CLASS} [class*="-module__utilityGroup__"] {
  gap: 0;
}

/* ---------- 3. Touch targets -------------------------------------- *
 * tokens.css already defines --app-hit-touch (44px) and switches
 * --app-hit-target on coarse pointers, but many pages hard-code
 * 32px buttons. Force the token to win for real buttons. */

@media (any-pointer: coarse) {
  html.${ROOT_CLASS} button.qwenpaw-btn:not(.qwenpaw-btn-text) {
    min-height: 40px;
  }

  html.${ROOT_CLASS} button.qwenpaw-btn-icon-only {
    min-width: 40px;
    min-height: 40px;
  }

  html.${ROOT_CLASS} [class*="-module__collapsedNavItem__"],
  html.${ROOT_CLASS} [class*="-module__collapseToggle__"] {
    min-width: 44px;
    min-height: 44px;
  }
}

/* ---------- 4. Composer ------------------------------------------- *
 * a) Safe area: the composer had no env(safe-area-inset-bottom)
 *    handling, so the iPhone home indicator overlapped the input.
 *
 * b) Desktop: cap the project-directory control so an overly long
 *    project name cannot blow out the composer row.
 *
 * c) Narrow screens: the action row is flex-wrap: nowrap +
 *    max-width: 100%, while the project control is flex: 1 1 150px
 *    and the approval control is a labelled dropdown. On a 390px
 *    phone the row needs ~365px but only ~200px is left, so buttons
 *    get squeezed out of the viewport. The Console composer is a
 *    two-column grid ([class$=-sender-content-bottom] ->
 *    minmax(0,1fr) auto); the grid is right, so keep it and give
 *    the action column a tidy row of its own: labelled controls
 *    collapse to 44px icons and everything stays on one tappable
 *    line.
 * ------------------------------------------------------------------ */

html.${ROOT_CLASS} [class*="-module__chatPageRoot__"] [class*="-module__mobileComposerControl__"],
html.${ROOT_CLASS} [class*="-module__senderActionAffix__"],
html.${ROOT_CLASS} [class*="-module__compactSenderAffix__"] {
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}

html.${ROOT_CLASS} [class*="-module__senderProjectControl__"] {
  flex: 0 1 auto !important;
  min-width: 0 !important;
}

@media (max-width: 768px) {
  /* Two-row grid: input column keeps its width, the action column
   * gets its own row. (v0.1.2 tried flex-direction: column, which
   * stacked the input under the actions and ejected the model
   * picker from the input box — the grid is what v0.1.3 restored.) */
  html.${ROOT_CLASS} [class$="-sender-content-bottom"] {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    align-items: end !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
  }

  html.${ROOT_CLASS} [class$="-sender-prefix"] {
    width: auto !important;
    flex: 1 1 auto !important;
    min-width: 0 !important;
  }

  html.${ROOT_CLASS} [class$="-sender-actions-list"] {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    justify-content: end !important;
    align-content: end !important;
    flex: 0 0 auto !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    margin-left: 0 !important;
    gap: 4px !important;
    overflow: hidden !important;
  }

  html.${ROOT_CLASS} [class$="-sender-actions-list"] > * {
    flex: 0 0 auto !important;
    height: 44px !important;
  }

  /* The affix span holds the icon controls; let it take its own width. */
  html.${ROOT_CLASS} [class*="-module__senderActionAffix__"] {
    flex: 0 0 auto !important;
    flex-wrap: nowrap !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    gap: 2px !important;
  }

  html.${ROOT_CLASS} [class*="-module__senderActionAffix__"] > * {
    flex: 0 0 auto !important;
  }

  /* The presets slot holds the send button; keep it square. */
  html.${ROOT_CLASS} [class$="-sender-actions-list-presets"] {
    flex: 0 0 auto !important;
    width: 44px !important;
    min-width: 44px !important;
    max-width: 44px !important;
  }

  /* Hide the zero-width context badge so it does not occupy a cell. */
  html.${ROOT_CLASS} [class*="-module__senderContextAffix__"] {
    display: none !important;
  }

  /* The project-directory and approval controls collapse to
   * icon-only: font-size: 0 hides the text nodes while svg icons
   * keep their explicit box. */
  html.${ROOT_CLASS} [class*="-module__senderProjectControl__"],
  html.${ROOT_CLASS} [class*="-module__senderApprovalControl__"] {
    flex: 0 0 auto !important;
    width: 44px !important;
    min-width: 44px !important;
    max-width: 44px !important;
    padding: 0 !important;
    gap: 0 !important;
    font-size: 0 !important;
    justify-content: center;
    overflow: hidden;
  }

  html.${ROOT_CLASS} [class*="-module__senderProjectControl__"] svg,
  html.${ROOT_CLASS} [class*="-module__senderApprovalControl__"] svg {
    width: 18px !important;
    height: 18px !important;
  }
}

/* ---------- 5. Tables ---------------------------------------------- *
 * Tables wider than the viewport get a horizontal scroll instead of
 * pushing the layout sideways. */

html.${ROOT_CLASS} [class*="-module__tableCard__"],
html.${ROOT_CLASS} [class*="-module__tableWrap__"],
html.${ROOT_CLASS} [class*="-module__tablePanel__"],
html.${ROOT_CLASS} .ant-table-wrapper {
  max-width: 100%;
  overflow-x: auto;
}

@media (max-width: 768px) {
  html.${ROOT_CLASS} [class*="-module__sessionsPage__"] [class*="-module__tableCard__"] {
    border-radius: 12px;
  }
}

/* ---------- 6. Reduced motion -------------------------------------- */

@media (prefers-reduced-motion: reduce) {
  html.${ROOT_CLASS} * {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
`;

/* ------------------------------------------------------------------ *
 * Settings store
 * ------------------------------------------------------------------ */

let state = { enabled: true, scope: "global" };

/** Load persisted settings. The JSON blob is the source of truth; the
 * legacy on/off flag only seeds it when no blob exists yet (migration
 * from pre-0.2.0 installs). */
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
          scope: parsed.scope === "mobile" ? "mobile" : "global",
        };
      }
    }
  } catch {
    /* corrupted or unavailable — fall through */
  }
  try {
    const legacy = localStorage.getItem(LEGACY_ENABLED_KEY);
    if (legacy !== null) return { enabled: legacy === "1", scope: "global" };
  } catch {
    /* ignore */
  }
  return { enabled: true, scope: "global" };
}

/** Persist current settings. The legacy flag is mirrored so an older
 * plugin build (or a wiped settings blob) still resolves the same
 * state. One writer, two keys — no desync possible. */
function persistSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
    localStorage.setItem(LEGACY_ENABLED_KEY, state.enabled ? "1" : "0");
  } catch {
    /* storage unavailable — in-memory state still applies this page load */
  }
}

/** Merge a patch into settings, persist, and re-evaluate the mode. */
function updateSettings(patch) {
  state = { ...state, ...patch };
  persistSettings();
  applyScope();
}

/** Public read: a copy, so callers cannot mutate the store. */
function readSettings() {
  return { ...state };
}

/* ------------------------------------------------------------------ *
 * Renderer
 * ------------------------------------------------------------------ */

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);
}

function isOn() {
  return document.documentElement.classList.contains(ROOT_CLASS);
}

/** Mode wanted by current settings + viewport (mobile scope = narrow only). */
function wantedState(s = state) {
  return s.enabled && (s.scope !== "mobile" || mobileQuery().matches);
}

function apply(on) {
  ensureStyle();
  const changed = isOn() !== !!on;
  document.documentElement.classList.toggle(ROOT_CLASS, !!on);
  if (changed) {
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: { enabled: !!on } }),
      );
    } catch {
      /* CustomEvent unsupported — ignore */
    }
  }
}

function applyScope() {
  apply(wantedState());
}

let mobileMq = null;
function mobileQuery() {
  if (!mobileMq) mobileMq = window.matchMedia(MOBILE_QUERY);
  return mobileMq;
}

/* ------------------------------------------------------------------ *
 * Self-healing: React can replace <html>'s class list on re-render.
 * Watch the root class attribute and re-assert the wanted state
 * (add *or* remove) instead of polling with timers. */

function watchRootClass() {
  if (typeof MutationObserver === "undefined") return;
  const observer = new MutationObserver(() => {
    const want = wantedState();
    if (want !== isOn()) apply(want);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

function watchViewport() {
  const mq = mobileQuery();
  const onChange = () => applyScope();
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange); // Safari < 14
}

/* ------------------------------------------------------------------ *
 * Public API (window.QwenPaw.simpleMode)
 * ------------------------------------------------------------------ */

function exposeApi() {
  const QwenPaw = window.QwenPaw;
  if (!QwenPaw) return;
  QwenPaw.simpleMode = {
    enable: () => updateSettings({ enabled: true }),
    disable: () => updateSettings({ enabled: false }),
    toggle: () => {
      updateSettings({ enabled: !state.enabled });
      return isOn();
    },
    isEnabled: isOn,
    setScope: (scope) => updateSettings({ scope: scope === "mobile" ? "mobile" : "global" }),
    getSettings: readSettings,
  };
}

/* ------------------------------------------------------------------ *
 * Toggle button (rendered into the chat right header)
 * ------------------------------------------------------------------ */

function mountToggleButton() {
  const QwenPaw = window.QwenPaw;
  if (!QwenPaw || !QwenPaw.chat || !QwenPaw.chat.rightHeader) return false;
  if (!QwenPaw.host || !QwenPaw.host.React) return false;

  const React = QwenPaw.host.React;
  const h = React.createElement;
  const antd = QwenPaw.host.antd || {};
  const Button = antd.Button;
  const Tooltip = antd.Tooltip;
  if (!Button || !Tooltip) return false;

  // The dot mirrors the *applied* state, so it re-reads isOn() on every
  // render; local state only exists to trigger that re-render.
  const ToggleButton = () => {
    const [tick, setTick] = React.useState(0);
    const on = isOn();
    return h(
      Tooltip,
      { title: on ? T.on : T.off },
      h(Button, {
        type: "text",
        "aria-label": T.name,
        "aria-pressed": on,
        title: T.name,
        icon: h(
          "span",
          {
            "aria-hidden": "true",
            style: {
              display: "block",
              width: 10,
              height: 10,
              boxSizing: "border-box",
              borderRadius: "50%",
              background: on ? "var(--app-accent, #ff7f16)" : "transparent",
              border: on ? "none" : "2px solid currentColor",
              boxShadow: on ? "0 0 6px var(--app-accent, #ff7f16)" : "none",
              opacity: on ? 1 : 0.55,
              transition: "background 0.15s ease, box-shadow 0.15s ease",
            },
          },
        ),
        onClick: (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          updateSettings({ enabled: !state.enabled });
          setTick((n) => n + 1);
        },
      }),
    );
  };

  try {
    QwenPaw.chat.rightHeader.add("simple-mode", h(ToggleButton), {
      id: "simple-mode-toggle",
      order: 100,
    });
    return true;
  } catch {
    return false;
  }
}

/** The chat SDK is installed before plugins load, so one attempt is
 * normally enough; retry once at window load as cheap insurance. */
function mountToggleButtonWithRetry() {
  if (mountToggleButton()) return;
  window.addEventListener("load", () => mountToggleButton(), { once: true });
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

function boot() {
  state = loadSettings();
  ensureStyle();
  applyScope();
  exposeApi();
  mountToggleButtonWithRetry();
  watchViewport();
  watchRootClass();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
