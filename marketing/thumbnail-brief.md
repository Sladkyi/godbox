# GodBox store thumbnail

- Asset: `public/thumbnail.jpg` — exactly 512×512 JPEG for RUN.world
- Master: generated 1:1 key art, then resized
- Placement: Explore grid, search, shared links

## What the research actually supports

RUN requires a unique `public/thumbnail.jpg` at **512×512**. The platform’s own tips: bold color, little text, show what you play. Deploy fails on the default placeholder. Source: [Setting Your Game Thumbnail](https://cdn.jsdelivr.net/npm/@series-inc/rundot-game-sdk@5.27.0/docs/rundot-developer-platform/setting-your-game-thumbnail.md).

Jylhä and Hamari (2019): **569 people, 68 icons, 2,276 ratings**. Perceived **quality** and **uniqueness** predicted willingness to tap. They did not find a universal “make it simple” rule. [Paper](https://researchportal.tuni.fi/files/19471939/1_s2.0_S1071581918301794_main.pdf).

Apple: one recognizable idea, shapes that survive small sizes, type only if it must be there. [HIG — App Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons).

YouTube thumbnail advice (readable type, check tiny size, curiosity) is for **video tiles**, not store icons. Source: [YouTube Help](https://support.google.com/youtube/answer/12340300?hl=en).

Steam small capsules fail when the logo dies at postage-stamp size; design for the smallest render, one focal subject, strong value contrast, squint/grayscale test. [Steamworks assets](https://partner.steamgames.com/doc/store/assets/standard).

Published icon A/B cases (Queens, Episode, Merge Ragdoll) show **some** icon changes move conversion, and that a clicky icon can attract the wrong players. Treat them as hypotheses, not a promised uplift.

## Applied direction for this tile

1. **Verb first:** a god-strike (hand + lightning + meteor) on a miniature living island — that is the game.
2. **Uniqueness:** four settlement colors (wood, ghoul, alien, mycelium) instead of a generic green map.
3. **Quality cue:** chunky stylized 3D close to the real Three.js look, not a photo and not clipart.
4. **Small-size read:** one silhouette (bolt/hand + island + ocean). Title **GODBOX** only, huge, on a quiet dark band — the listing name may not travel with shared-link previews.
5. **No slogan.** Slogans help YouTube; they crowd a 512 tile.

No live CTR test was run. This is the first catalogue tile, not a measured winner.

## Shipped

- Master: `marketing/godbox-thumbnail-master.png` (1024×1024)
- RUN asset: `public/thumbnail.jpg` (exactly 512×512 JPEG, ~75 KB)
- Game ID `t7jDe3ia64IJzR7OUnJX`, version **1.0.0**, submitted to Explore review on 15 Sep 2026. Public listing goes live after RUN review.
