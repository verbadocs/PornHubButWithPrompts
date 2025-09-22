(() => {
  const doc = document;

  // ------- sidebar + styles (unchanged) -------
  const SIDEBAR_WIDTH = 420;
  if (!doc.getElementById("gh-mini-sidebar-styles")) {
    const st = doc.createElement("style");
    st.id = "gh-mini-sidebar-styles";
    st.textContent = `
      :root { --ghms-width: ${SIDEBAR_WIDTH}px; }
      #gh-mini-sidebar { position: fixed; top: 0; right: 0; height: 100vh;
        width: var(--ghms-width); max-width: 92vw; background: #0d1117; color: #c9d1d9;
        border-left: 1px solid #30363d; box-shadow: -8px 0 40px rgba(0,0,0,.35);
        font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        transform: translateX(100%); transition: transform .2s ease-in-out; z-index: 99999;
        display: flex; flex-direction: column; }
      #gh-mini-sidebar.open { transform: translateX(0); }
      #gh-mini-sidebar .ghms-header { display:flex; align-items:center; justify-content:space-between;
        padding: 12px 16px; border-bottom: 1px solid #30363d; }
      #gh-mini-sidebar .ghms-title { font-weight:600; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #gh-mini-sidebar .ghms-close { border:1px solid #30363d; background:#161b22; color:inherit;
        border-radius:6px; padding:4px 8px; cursor:pointer; }
      #gh-mini-sidebar .ghms-body { padding:16px; overflow:auto; height:100%; }
      #gh-mini-notes { width:100%; min-height:180px; background:#161b22; border:1px solid #30363d;
        color:inherit; border-radius:8px; padding:8px; resize:vertical; }
      body.ghms-pushed { padding-right: var(--ghms-width) !important; transition: padding-right .2s ease-in-out; }
      .header-logged-in, .AppHeader-globalBar { transition: padding-right .2s ease-in-out; }
    `;
    doc.head.appendChild(st);
  }
  let sidebar = doc.getElementById("gh-mini-sidebar");
  if (!sidebar) {
    sidebar = doc.createElement("div");
    sidebar.id = "gh-mini-sidebar";
    sidebar.innerHTML = `
      <div class="ghms-header">
        <strong class="ghms-title" id="gh-mini-title">File</strong>
        <button class="ghms-close" id="gh-mini-close">Close</button>
      </div>
      <div class="ghms-body">
        <textarea id="gh-mini-notes" placeholder="Notes…"></textarea>
      </div>`;
    doc.body.appendChild(sidebar);
    doc.getElementById("gh-mini-close").onclick = () => {
      sidebar.classList.remove("open");
      doc.body.classList.remove("ghms-pushed");
    };
  }
  const openSidebar = (title) => {
    doc.getElementById("gh-mini-title").textContent = title || "File";
    const w = sidebar.getBoundingClientRect().width || SIDEBAR_WIDTH;
    doc.documentElement.style.setProperty("--ghms-width", `${w}px`);
    doc.body.classList.add("ghms-pushed");
    sidebar.classList.add("open");
  };
  const guessFileTitle = (row) => {
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
  };

  // ------- robust finder (global scan + debug) -------
  function findHeaderRows(documentRoot) {
    const rows = new Set();

    // A) Exact utility layout you showed (order can be at base or at sm breakpoint)
    const classRows = Array.from(
      documentRoot.querySelectorAll(
        "div.d-flex.flex-justify-end.flex-items-center"
      )
    ).filter((el) => {
      const cls = el.className || "";
      return /\bflex-order-2\b/.test(cls) || /\bflex-sm-order-2\b/.test(cls);
    });
    classRows.forEach((el) => rows.add(el));
    console.log("[finder] utility rows:", classRows.length);

    // B) From kebab/options button → nearest right-justified d-flex
    const kebabRows = [];
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
        if (right && center) {
          kebabRows.push(cand);
          rows.add(cand);
        }
      });
    console.log("[finder] kebab-derived rows:", kebabRows.length);

    // C) Legacy/classic
    const legacyRows = documentRoot.querySelectorAll(
      '.file-header .file-actions, .file-header div[role="group"]'
    );
    legacyRows.forEach((el) => rows.add(el));
    console.log("[finder] legacy rows:", legacyRows.length);

    return Array.from(rows);
  }

  // ------- inject (idempotent) -------
  function inject() {
    const rows = findHeaderRows(doc);
    console.log("[inject] total rows:", rows.length);
    rows.forEach((row) => {
      if (row.querySelector(".gh-open-modal-btn")) return;
      const btn = doc.createElement("button");
      btn.className = "gh-open-modal-btn";
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

  inject();
  new MutationObserver(inject).observe(doc.documentElement, {
    childList: true,
    subtree: true,
  });
})();
