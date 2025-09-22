// ==UserScript==
// @name         GitHub Diff: Prompt History Sidebar
// @namespace    local.verba
// @version      1.2.0
// @description  Adds a per-file "Prompt History" button that opens a right sidebar and pushes the page (no overlay). Auto-detects GitHub’s new utility-class layout.
// @author       you
// @match        https://github.com/*/*/commit/*
// @match        https://github.com/*/*/pull/*/files*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const BTN_CLASS = "gh-open-modal-btn";
  const SIDEBAR_ID = "gh-mini-sidebar";
  const STYLE_ID = "gh-mini-sidebar-styles";
  const SIDEBAR_WIDTH = 420; // px

  const doc = document;

  // ---------- styles (once)
  function ensureStyles() {
    if (doc.getElementById(STYLE_ID)) return;
    const st = doc.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
      :root { --ghms-width: ${SIDEBAR_WIDTH}px; }

      #${SIDEBAR_ID} {
        position: fixed; top: 0; right: 0; height: 100vh;
        width: var(--ghms-width); max-width: 92vw;
        background: #0d1117; color: #c9d1d9;
        border-left: 1px solid #30363d; box-shadow: -8px 0 40px rgba(0,0,0,.35);
        font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        transform: translateX(100%); transition: transform .2s ease-in-out;
        z-index: 99999; display: flex; flex-direction: column;
      }
      #${SIDEBAR_ID}.open { transform: translateX(0); }

      #${SIDEBAR_ID} .ghms-header {
        display:flex; align-items:center; justify-content:space-between;
        padding: 12px 16px; border-bottom: 1px solid #30363d;
      }
      #${SIDEBAR_ID} .ghms-title { font-weight:600; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #${SIDEBAR_ID} .ghms-close {
        border:1px solid #30363d; background:#161b22; color:inherit;
        border-radius:6px; padding:4px 8px; cursor:pointer;
      }

      #${SIDEBAR_ID} .ghms-body { padding:16px; overflow:auto; height:100%; }
      #gh-mini-notes {
        width:100%; min-height:180px; background:#161b22; border:1px solid #30363d;
        color:inherit; border-radius:8px; padding:8px; resize:vertical;
      }

      /* Push page content when sidebar opens (no overlay) */
      body.ghms-pushed { padding-right: var(--ghms-width) !important; transition: padding-right .2s ease-in-out; }
      .header-logged-in, .AppHeader-globalBar { transition: padding-right .2s ease-in-out; }
    `;
    doc.head.appendChild(st);
  }

  // ---------- sidebar (once)
  function ensureSidebar() {
    let sidebar = doc.getElementById(SIDEBAR_ID);
    if (sidebar) return sidebar;

    sidebar = doc.createElement("div");
    sidebar.id = SIDEBAR_ID;
    sidebar.innerHTML = `
      <div class="ghms-header">
        <strong class="ghms-title" id="gh-mini-title">File</strong>
        <button class="ghms-close" id="gh-mini-close">Close</button>
      </div>
      <div class="ghms-body">
        <textarea id="gh-mini-notes" placeholder="Notes…"></textarea>
      </div>
    `;
    doc.body.appendChild(sidebar);

    doc.getElementById("gh-mini-close").onclick = () => {
      sidebar.classList.remove("open");
      doc.body.classList.remove("ghms-pushed");
    };

    return sidebar;
  }

  function openSidebar(title) {
    const sidebar = ensureSidebar();
    ensureStyles();

    doc.getElementById("gh-mini-title").textContent = title || "File";
    const w = sidebar.getBoundingClientRect().width || SIDEBAR_WIDTH;
    doc.documentElement.style.setProperty("--ghms-width", `${w}px`);

    doc.body.classList.add("ghms-pushed");
    sidebar.classList.add("open");
  }

  // ---------- filename/title helper
  function guessFileTitle(row) {
    const scope =
      row.closest(".file, .Box") ||
      row.closest("div") ||
      row.parentElement ||
      doc;
    const a = scope.querySelector('a[href*="/blob/"]');
    const raw = (a?.getAttribute("title") || a?.textContent || "").trim();
    const text =
      raw || (scope.querySelector("strong, span")?.textContent || "").trim();
    return text.replace(/^Collapse file:\s*/i, "") || "File";
  }

  // ---------- finder: identify the right-side action rows
  function findHeaderRows(documentRoot) {
    const rows = new Set();

    // A) New utility-class layout: right-justified row with order=2 at some breakpoint
    const utilRows = Array.from(
      documentRoot.querySelectorAll(
        "div.d-flex.flex-justify-end.flex-items-center"
      )
    ).filter((el) => {
      const cls = el.className || "";
      return /\bflex-order-2\b/.test(cls) || /\bflex-sm-order-2\b/.test(cls);
    });
    utilRows.forEach((el) => rows.add(el));

    // B) Kebab/options fallback → nearest right-justified d-flex row
    documentRoot
      .querySelectorAll(
        'button[aria-haspopup="menu"], button[aria-haspopup="true"]'
      )
      .forEach((btn) => {
        let cand = btn.closest("div.d-flex") || btn.closest("div");
        if (!cand) return;
        const right =
          cand.classList.contains("flex-justify-end") ||
          getComputedStyle(cand).justifyContent === "flex-end";
        const center =
          cand.classList.contains("flex-items-center") ||
          getComputedStyle(cand).alignItems === "center";
        if (right && center) rows.add(cand);
      });

    // C) Legacy/classic GitHub header
    documentRoot
      .querySelectorAll(
        '.file-header .file-actions, .file-header div[role="group"]'
      )
      .forEach((el) => rows.add(el));

    return Array.from(rows);
  }

  // ---------- inject buttons (idempotent)
  function inject() {
    const rows = findHeaderRows(doc);
    rows.forEach((row) => {
      if (row.querySelector(`.${BTN_CLASS}`)) return;

      const btn = doc.createElement("button");
      btn.className = BTN_CLASS;
      btn.textContent = "Prompt History";
      btn.style.cssText =
        "margin-left:8px;padding:4px 8px;border:1px solid #30363d;border-radius:6px;background:#161b22;color:#c9d1d9;cursor:pointer";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSidebar(guessFileTitle(row));
      });

      row.appendChild(btn);
    });
  }

  // ---------- boot + observe SPA/navigation updates
  const boot = () => {
    ensureStyles();
    ensureSidebar();
    inject();
  };
  boot();

  // Observe DOM changes (GitHub is SPA-ish)
  const mo = new MutationObserver(() => inject());
  mo.observe(doc.documentElement, { childList: true, subtree: true });

  // Re-run on PJAX/nav changes
  window.addEventListener("turbo:load", boot);
  document.addEventListener("pjax:end", boot);
})();
