(() => {
  const store = window.TWITCHCRAFT_STORE;
  if (!store) {
    console.error("Missing TWITCHCRAFT_STORE catalog");
    return;
  }

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const catalog = document.getElementById("catalog");
  const empty = document.getElementById("empty");
  const countLabel = document.getElementById("count-label");
  const search = document.getElementById("search");
  const toast = document.getElementById("toast");

  let activeTab = "items";
  let toastTimer = 0;

  function entriesFor(tab) {
    return Array.isArray(store[tab]) ? store[tab] : [];
  }

  function matches(entry, q) {
    if (!q) return true;
    if (entry.type === "section") {
      return (entry.title || "").toLowerCase().includes(q);
    }
    if (entry.type === "help") {
      return (entry.text || "").toLowerCase().includes(q);
    }
    const hay = `${entry.name || ""} ${entry.cmd || ""} ${entry.desc || ""}`.toLowerCase();
    return hay.includes(q);
  }

  function showToast(message) {
    toast.hidden = false;
    toast.textContent = message;
    toast.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-on");
    }, 1400);
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    button.classList.add("is-copied");
    button.textContent = "COPIED";
    showToast("Copied to clipboard");
    window.setTimeout(() => {
      button.classList.remove("is-copied");
      button.textContent = "COPY";
    }, 1200);
  }

  function renderHelp(entry) {
    const el = document.createElement("p");
    el.className = "help-line";
    el.textContent = entry.text;
    return el;
  }

  function renderSection(entry) {
    const el = document.createElement("h3");
    el.className = "section-title";
    el.textContent = entry.title;
    return el;
  }

  function renderRow(entry, inlineDesc) {
    const row = document.createElement("article");
    row.className = "row";

    const main = document.createElement("div");
    main.className = "row-main";

    const name = document.createElement("h2");
    name.className = "row-name";
    name.textContent = entry.name;

    const cmdLine = document.createElement("p");
    cmdLine.className = "row-cmd";

    const cmd = document.createElement("span");
    cmd.className = "cmd-text";
    cmd.textContent = entry.cmd;
    cmdLine.append(cmd);

    if (inlineDesc && entry.desc) {
      const desc = document.createElement("span");
      desc.className = "cmd-desc";
      desc.textContent = ` — ${entry.desc}`;
      cmdLine.append(desc);
    }

    main.append(name, cmdLine);

    if (!inlineDesc && entry.desc) {
      const desc = document.createElement("p");
      desc.className = "row-desc";
      desc.textContent = entry.desc;
      main.append(desc);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "COPY";
    btn.setAttribute("aria-label", `Copy ${entry.cmd}`);
    btn.addEventListener("click", () => copyText(entry.cmd, btn));

    row.append(main, btn);
    return row;
  }

  function render() {
    const q = (search.value || "").trim().toLowerCase();
    const list = entriesFor(activeTab).filter((e) => matches(e, q));
    catalog.innerHTML = "";

    const copyable = list.filter((e) => e.cmd);
    empty.classList.toggle("hidden", list.length > 0);
    countLabel.textContent = `${copyable.length} command${copyable.length === 1 ? "" : "s"}`;

    const frag = document.createDocumentFragment();
    const inlineDesc = activeTab === "curses";

    for (const entry of list) {
      if (entry.type === "help") {
        frag.append(renderHelp(entry));
        continue;
      }
      if (entry.type === "section") {
        frag.append(renderSection(entry));
        continue;
      }
      frag.append(renderRow(entry, inlineDesc));
    }
    catalog.append(frag);
  }

  function setTab(tab) {
    activeTab = tab;
    for (const el of tabs) {
      const on = el.dataset.tab === tab;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
    }
    render();
  }

  for (const el of tabs) {
    el.addEventListener("click", () => setTab(el.dataset.tab));
  }

  search.addEventListener("input", render);
  setTab(activeTab);
})();
