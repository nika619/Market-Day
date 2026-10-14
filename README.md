# Market Day — a cinematic ad template for SVGator

A 15-second, 1920×1080 looping ad template built entirely as an SVGator project for the
[SVGator × Contra animation template challenge](https://contra.com/community/topic/svgatorchallenge).
A seller ties off a parcel at a market stall, the string lights come on, they hold out a wooden tray,
and **your product** lands on it before **your headline** fades up on a frosted-glass card.

One template, three businesses: an Italian wood-fired pizza café, a candle maker and a ceramics studio,
each made by changing the same handful of named layers. No keyframe is touched.

## Make it yours (about five minutes in the SVGator editor)

| Layer | What to do |
|---|---|
| `headline (max 3 lines, 9 chars each)` | Retype. The last line takes the accent colour. |
| `subline` | Retype (two short lines). |
| `cta-text (max 12 chars)` | Retype. |
| `product-image` | Image options → Replace image. Any photo; it is cropped to a circle. |
| `logo` | Image options → Replace image. Light logo, transparent background. |
| `brand-color` | One soft-light rectangle that grades the whole film. Opacity 0 keeps the warm original. |

All text is live (Fraunces and DM Sans, Google Fonts, Open Font License) and every element is named.
Motion lives on wrapper groups, never on the text or on the swappable images, so swapping content never breaks an animation.

## What is in this repository

- `assets/` — every picture the SVGator projects load. They are linked, not embedded, and served by jsDelivr:
  `https://cdn.jsdelivr.net/gh/nika619/conjure-svgator@main/assets/<file>`.
  - `assets/market/` — Market Day: stall plate, seller cut-out, presentation frames, sprites, demo products and logos.
  - the files at the root of `assets/` — shared light sprites (glow, spark, streak, vignette) and the art of *Conjure*, an earlier fantasy concept kept for reference.
- `build/` — the code that writes the SVGator project documents and checks them:
  - `scene-market.js` builds the Market Day document (multiplane camera, frosted card, slots) from a content file (`content-market*.js`).
  - `player.js` + `preview-market.html` play a document locally with the same transform maths as SVGator's export; `shots.js` / `fill.js` render frames through headless Edge.
  - `prep-market.py` turns the generated art into the web-ready files in `assets/market/`; `mix-market.py` builds the soundtrack for the proof video.
  - `scene-take.js`, `scene-unbox.js`, `track.py`, `take-frames.py` — experiments: a live-action "one take" build and a native vector unboxing with real 3D projection.

## How it was made

The art was generated for this template (GPT Image 2.5 for the plates, Seedance 2.5 for the presentation clip,
ElevenLabs for the music). The SVGator projects were written and edited through the **SVGator MCP** with Claude:
the documents in `build/` are generated, sent with `create_project`, and the content sets are made with
`duplicate_project` plus a few `edit_part` calls on the named slots.

All demo brands are fictional.
