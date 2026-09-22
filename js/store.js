(() => {
  const store = window.TWITCHCRAFT_STORE;
  if (!store) {
    console.error("Missing TWITCHCRAFT_STORE catalog");
    return;
  }

  const ICON_TABS = new Set(["items", "equipment", "potions", "arrows"]);

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const catalog = document.getElementById("catalog");
  const empty = document.getElementById("empty");
  const countLabel = document.getElementById("count-label");
  const search = document.getElementById("search");
  const toast = document.getElementById("toast");

  let activeTab = "items";
  let toastTimer = 0;
  let atlas = null;
  let atlasImg = null;
  const tintCache = new Map();

  // Vanilla 1.20.x potion colors (decimal → used as RGB tint on overlay).
  const POTION_COLORS = {
    water: 3694022,
    mundane: 8355711,
    thick: 9143964,
    awkward: 5578058,
    night_vision: 2039713,
    invisibility: 8356754,
    leaping: 2293580,
    fire_resistance: 14981690,
    swiftness: 8171462,
    slowness: 5926017,
    turtle_master: 7695136,
    water_breathing: 3035801,
    healing: 16262179,
    harming: 4393481,
    poison: 5149489,
    regeneration: 13458603,
    strength: 9643043,
    weakness: 4738376,
    luck: 3381504,
    slow_falling: 15978425,
  };

  const EFFECT_ALIASES = {
    regen: "regeneration",
    heal: "healing",
    harm: "harming",
    jump: "leaping",
    speed: "swiftness",
    fireresist: "fire_resistance",
    fire_resist: "fire_resistance",
  };

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

  function itemIdFromCmd(cmd) {
    if (!cmd || !cmd.startsWith("#give")) return null;
    const m = cmd.match(/^#give\s+(?:@)?(?:minecraft:)?([a-z0-9_]+)/i);
    return m ? m[1].toLowerCase() : null;
  }

  function effectKeyFromCmd(cmd) {
    if (!cmd) return null;
    const bracket = cmd.match(/\[([^\]]+)\]/);
    if (!bracket) return null;
    let inner = bracket[1].trim().toLowerCase();
    inner = inner.replace(/^potion\s*=\s*(?:minecraft:)?/, "");
    inner = inner.replace(/^(long|strong)[\s_]+/, "");
    inner = inner.replace(/[\s_]+\d+$/, "");
    inner = inner.replace(/\s+/g, "_").replace(/_+/g, "_");
    if (EFFECT_ALIASES[inner]) inner = EFFECT_ALIASES[inner];
    return inner || null;
  }

  function potionColor(effectKey) {
    if (!effectKey) return POTION_COLORS.water;
    if (POTION_COLORS[effectKey] != null) return POTION_COLORS[effectKey];
    // long_poison / strong_healing already stripped; try without leftover prefixes
    const bare = effectKey.replace(/^(long_|strong_)/, "");
    return POTION_COLORS[bare] != null ? POTION_COLORS[bare] : POTION_COLORS.water;
  }

  function resolveIconId(itemId) {
    if (!itemId || !atlas) return null;
    if (atlas[itemId]) return itemId;
    const aliases = atlas._aliases || {};
    if (aliases[itemId] && atlas[aliases[itemId]]) return aliases[itemId];
    if (itemId === "arrow") return atlas.arrow ? "arrow" : null;
    return null;
  }

  function tintLayersFor(itemId, effectKey) {
    const carriers = new Set(["potion", "splash_potion", "lingering_potion"]);
    if (carriers.has(itemId) && effectKey) {
      return { base: itemId, overlay: "potion_overlay", color: potionColor(effectKey) };
    }
    // plain water bottle etc. still tint blue-ish for water/awkward/mundane/thick
    if (carriers.has(itemId) && !effectKey) {
      return { base: itemId, overlay: "potion_overlay", color: POTION_COLORS.water };
    }
    if ((itemId === "tipped_arrow" || itemId === "arrow") && effectKey) {
      return {
        base: "tipped_arrow_base",
        overlay: "tipped_arrow_head",
        color: potionColor(effectKey),
      };
    }
    return null;
  }

  function drawAtlasTile(ctx, key, dx, dy, size) {
    const uv = atlas[key];
    if (!uv || !atlasImg) return false;
    ctx.drawImage(atlasImg, uv.x, uv.y, uv.w, uv.h, dx, dy, size, size);
    return true;
  }

  function composeTintedIcon(baseKey, overlayKey, colorDec) {
    const cacheKey = `${baseKey}|${overlayKey}|${colorDec}`;
    if (tintCache.has(cacheKey)) return tintCache.get(cacheKey);

    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Overlay first (tinted), then bottle/base on top — matches MC item model layers.
    const ov = document.createElement("canvas");
    ov.width = size;
    ov.height = size;
    const octx = ov.getContext("2d");
    if (!drawAtlasTile(octx, overlayKey, 0, 0, size)) {
      tintCache.set(cacheKey, null);
      return null;
    }
    const img = octx.getImageData(0, 0, size, size);
    const r = (colorDec >> 16) & 255;
    const g = (colorDec >> 8) & 255;
    const b = colorDec & 255;
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = (d[i] * r) / 255;
      d[i + 1] = (d[i + 1] * g) / 255;
      d[i + 2] = (d[i + 2] * b) / 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.drawImage(ov, 0, 0);
    drawAtlasTile(ctx, baseKey, 0, 0, size);

    const url = canvas.toDataURL("image/png");
    tintCache.set(cacheKey, url);
    return url;
  }

  function makeIcon(cmd) {
    const wrap = document.createElement("div");
    wrap.className = "icon";
    wrap.setAttribute("aria-hidden", "true");

    const itemId = itemIdFromCmd(cmd);
    const effectKey = effectKeyFromCmd(cmd);
    const tint = tintLayersFor(itemId, effectKey);

    if (tint && atlasImg && atlas[tint.base] && atlas[tint.overlay]) {
      const url = composeTintedIcon(tint.base, tint.overlay, tint.color);
      if (url) {
        const img = document.createElement("img");
        img.className = "icon-img";
        img.src = url;
        img.width = 32;
        img.height = 32;
        img.alt = "";
        wrap.append(img);
        return wrap;
      }
    }

    const key = resolveIconId(itemId);
    if (!key || !atlas || !atlas[key]) {
      wrap.classList.add("icon-missing");
      return wrap;
    }

    const uv = atlas[key];
    const tile = (atlas._meta && atlas._meta.tile) || 16;
    const scale = 2;
    const el = document.createElement("span");
    el.className = "icon-sprite";
    el.style.width = `${tile * scale}px`;
    el.style.height = `${tile * scale}px`;
    el.style.backgroundImage = "url('assets/atlas.png')";
    el.style.backgroundPosition = `-${uv.x * scale}px -${uv.y * scale}px`;
    el.style.backgroundSize = `${atlas._meta.cols * tile * scale}px ${atlas._meta.rows * tile * scale}px`;
    wrap.append(el);
    return wrap;
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

  function renderRow(entry, inlineDesc, withIcon) {
    const row = document.createElement("article");
    row.className = withIcon ? "row row-icon" : "row";

    if (withIcon) {
      row.append(makeIcon(entry.cmd));
    }

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
    const withIcon = ICON_TABS.has(activeTab);

    for (const entry of list) {
      if (entry.type === "help") {
        frag.append(renderHelp(entry));
        continue;
      }
      if (entry.type === "section") {
        frag.append(renderSection(entry));
        continue;
      }
      frag.append(renderRow(entry, inlineDesc, withIcon));
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

  function boot(data) {
    atlas = data;
    const img = new Image();
    img.onload = () => {
      atlasImg = img;
      setTab(activeTab);
    };
    img.onerror = () => {
      console.warn("Atlas image failed to load; tinted potions disabled");
      setTab(activeTab);
    };
    img.src = "assets/atlas.png";
  }

  fetch("assets/atlas.json")
    .then((r) => r.json())
    .then(boot)
    .catch((err) => {
      console.warn("Atlas failed to load; icons disabled", err);
      setTab(activeTab);
    });
})();
