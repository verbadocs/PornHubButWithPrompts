(() => {
  const target = $0; // select the header action row first so it's $0
  if (!target) {
    console.warn("Select the header actions row first (so it’s $0).");
    return;
  }
  const doc = target.ownerDocument;

  // ---- config ----
  const SIDEBAR_WIDTH = 420; // px; change if you tweak width below

  // ---- styles (once) ----
  if (!doc.getElementById("gh-mini-sidebar-styles")) {
    const st = doc.createElement("style");
    st.id = "gh-mini-sidebar-styles";
    st.textContent = `
      :root { --ghms-width: ${SIDEBAR_WIDTH}px; }
      #gh-mini-sidebar {
        position: fixed; top: 0; right: 0; height: 100vh;
        width: var(--ghms-width); max-width: 92vw;
        background: #0d1117; color: #c9d1d9;
        border-left: 1px solid #30363d; box-shadow: -8px 0 40px rgba(0,0,0,.35);
        font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        transform: translateX(100%); transition: transform .2s ease-in-out;
        z-index: 99999; display: flex; flex-direction: column;
      }
      #gh-mini-sidebar.open { transform: translateX(0); }
      #gh-mini-sidebar .ghms-header {
        display:flex; align-items:center; justify-content:space-between;
        padding: 12px 16px; border-bottom: 1px solid #30363d;
      }
      #gh-mini-sidebar .ghms-title { font-weight:600; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #gh-mini-sidebar .ghms-close {
        border:1px solid #30363d; background:#161b22; color:inherit;
        border-radius:6px; padding:4px 8px; cursor:pointer;
      }
      #gh-mini-sidebar .ghms-body { padding:16px; overflow:auto; height:100%; }
      #gh-mini-notes {
        width:100%; min-height:180px; background:#161b22; border:1px solid #30363d;
        color:inherit; border-radius:8px; padding:8px; resize:vertical;
      }

      /* When sidebar is open, push the page content left by adding padding-right */
      body.ghms-pushed { padding-right: var(--ghms-width) !important; transition: padding-right .2s ease-in-out; }
      /* Keep GitHub’s header from jumping if needed */
      .header-logged-in, .AppHeader-globalBar { transition: padding-right .2s ease-in-out; }
    `;
    doc.head.appendChild(st);
  }

  // ---- sidebar (once) ----
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
      </div>
    `;
    doc.body.appendChild(sidebar);
    doc.getElementById("gh-mini-close").onclick = () => {
      sidebar.classList.remove("open");
      doc.body.classList.remove("ghms-pushed");
    };
  }

  const openSidebar = (title) => {
    doc.getElementById("gh-mini-title").textContent = title || "File";
    // ensure the CSS var matches the actual width (in case you tweak it)
    const w = sidebar.getBoundingClientRect().width || SIDEBAR_WIDTH;
    doc.documentElement.style.setProperty("--ghms-width", `${w}px`);
    doc.body.classList.add("ghms-pushed");
    sidebar.classList.add("open");
  };

  // Helper to guess a filename string near a header row
  const guessFileTitle = (row) => {
    const scope =
      row.closest("div")?.parentElement || row.parentElement || document;

    // Prefer the filename anchor
    const a = scope.querySelector('a[href*="/blob/"]');
    const raw = (a?.getAttribute("title") || a?.textContent || "").trim();

    // Fallback: grab any nearby text but strip the “Collapse file:” prefix if present
    const text =
      raw || (scope.querySelector("strong, span")?.textContent || "").trim();
    return text.replace(/^Collapse file:\s*/i, "") || "File";
  };

  // Build a selector from $0’s tag + classes so we can find all similar rows
  const tag = target.tagName.toLowerCase();
  const cls = [...target.classList].map((c) => `.${CSS.escape(c)}`).join("");
  const selector = `${tag}${cls}`;
  const rows = doc.querySelectorAll(selector);

  console.log("[inject] derived selector:", selector);
  console.log("[inject] matched rows:", rows.length);

  // Function to add a button to one row
  const addBtn = (row) => {
    if (row.querySelector(".gh-open-modal-btn")) return;
    const btn = doc.createElement("button");
    btn.className = "gh-open-modal-btn";
    btn.textContent = "Prompt History";
    btn.style.cssText =
      "margin-left:8px;padding:4px 8px;border:1px solid #30363d;border-radius:6px;background:#161b22;color:#c9d1d9;cursor:pointer";
    btn.onclick = (e) => {
      e.stopPropagation();
      openSidebar(guessFileTitle(row));
    };
    row.appendChild(btn);
  };

  // Prove it on the selected row, then on all similar rows
  addBtn(target);
  rows.forEach(addBtn);
  console.log("[inject] sidebar (push) buttons added.");
})();
