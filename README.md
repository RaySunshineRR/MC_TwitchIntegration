# TwichCraft Command Store

GitHub Pages storefront for **0x TwichCraft** Twitch `#commands`.

Live site (after Pages is enabled):  
https://raysunshinerr.github.io/MC_TwitchIntegration/

## Features

- Tabs: **Items · Equipment · Arrows · Books · Potions · Curses**
- Shorthand `#give` / curse commands ready for Twitch chat
- Press Start 2P (P2P) retro type
- Green **COPY** button → clipboard
- Curses include short explanations
- Search across name / command / description

## Local preview

Open `index.html` in a browser, or:

```bash
cd MC_TwitchIntegration
python3 -m http.server 8080
```

Then visit http://localhost:8080

## Item icons

Vanilla **1.20.1** item/block textures are packed into:

- `assets/atlas.png` — sprite sheet
- `assets/atlas.json` — id → UV map (+ `_aliases`)

Rebuild from the local Prism client jar:

```bash
python3 tools/build-atlas.py
```

Icons show on **Items / Equipment / Arrows / Potions**.

## Enable GitHub Pages

1. Repo **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / folder: `/ (root)`
4. Save — site appears at the URL above in a minute or two

## Update catalog

Edit `js/commands-data.js`, commit, push to `main`.
