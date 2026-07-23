# Quanfora clay scroll world — Google Flow handoff

## Current landing-page playback assets

- `scroll-scene-4k.mp4` is the supplied continuous source film and remains unchanged.
- `scroll-scene-scrub.mp4` is the web playback derivative: silent H.264, fast-start enabled, and encoded with frequent keyframes for responsive scroll seeking.
- `scroll-scene-poster.jpg` is the frame-safe poster shown while the film loads and in static fallbacks.
- The landing page scrubs the single desktop film across the six narrative beats below. Portrait/mobile and reduced-motion visitors receive the complete static journey because a native 9:16 film has not been supplied; the desktop film is not cropped into a mobile substitute.

Use this brief to generate the media for the landing-page scroll journey. The implementation uses six sequential clips in a **continuous forward take**. Do not generate six unrelated scene videos: clips 2–6 must continue from the preceding clip's real final frame or Flow continuation.

## Global rules

- Use one Flow video model, quality preset, seed strategy, and visual treatment for the complete chain.
- Desktop deliverables are native 16:9. Mobile deliverables are separately composed native 9:16—not crops.
- Generate without text, numbers, captions, watermarks, logos, interface labels, or people.
- Keep the focal structure centered. On mobile, keep important detail in the upper 60% so the HTML copy remains readable below.
- Every clip is 8 seconds, silent, and contains one continuous camera move with no cut, dissolve, whip transition, or camera-direction reversal.
- Every clip begins by continuing a slow forward drift and spends its final second settling into that same slow forward drift.

### Shared still-image preamble

Copy this paragraph unchanged at the start of every image prompt:

> Premium isometric low-poly clay diorama floating as a rounded miniature island on a plain matte near-black #07080B background. Soft hand-shaped clay forms, gently rounded edges, subtle fingerprints and tactile imperfections, restrained tilt-shift depth of field, warm studio key light from upper left, soft contact shadow beneath the island, quiet institutional financial design, cohesive palette of graphite #25262B, warm sand #C7B39A, porcelain #E8D9C7, muted periwinkle #7776C9, dusty teal #58BFC2, sage #78A98B, and ochre #D9A441. Elegant, precise, calm, highly detailed, no people, no text, no letters, no numbers, no logos, no watermarks.

For desktop append: `Wide cinematic 16:9 composition, centered island, generous negative space on the left for HTML copy.`

For mobile append: `Native portrait 9:16 composition designed from scratch, centered island in the upper half, generous dark negative space in the lower half for HTML copy; not a crop of a landscape image.`

## Scene still prompts

Generate one desktop and one mobile concept still for each scene using the shared preamble.

### 01 — Signal

> Subject: A miniature market observatory on a clay island. Rounded quote pylons, tiny candle-chart blocks without symbols, news capsules, sentiment beads, and fundamental-data streams travel along raised clay paths toward a central teal intake pavilion. The data sources are visually distinct but organized, with no readable markings. The forward camera path enters through a clear opening beyond the pavilion.

### 02 — Evidence

> Subject: A miniature evidence library and source archive. Rounded filing towers, layered document tablets without writing, citation tokens, assumption stones, and softly illuminated archive shelves surround a central periwinkle reading chamber. Clay pathways visibly connect every source to the chamber. A clear forward corridor leads into the next room.

### 03 — Agents

> Subject: A multi-agent research chamber represented without people. Four distinct rounded clay analysis pods—market, quantitative, risk, and data—surround a central synthesis table. Separate colored paths remain visibly independent before converging at the table. Use dusty lavender and muted periwinkle accents. A forward doorway remains open behind the table.

### 04 — Risk

> Subject: A clay risk-control checkpoint. Rounded ochre inspection gates evaluate miniature exposure towers, valuation weights, drawdown basins, and position-sizing blocks. Restrained terracotta warning accents appear only at failed checks; safe paths continue through the center. The forward camera route passes cleanly through the final gate.

### 05 — Portfolio

> Subject: A miniature portfolio-construction garden. Rounded asset towers of varied height stand on connected allocation terraces. A classical allocation path and a subtle quantum lattice path compare alternatives before rebalancing into a calm sage composition. The camera route curves gently around the allocation centerpiece and exits forward.

### 06 — Decision

> Subject: A calm documented-decision pavilion. All prior colored research paths resolve into one centered clay decision artifact surrounded by a thesis tablet without writing, risk-limit tokens, journal blocks, and paper-trading markers. The pavilion feels conclusive and quiet, with muted periwinkle as the hero accent and a broad clean landing area for the camera to settle.

## Continuous video prompts

### Clip 01 — Signal intake

Start from the approved Signal still.

> Single continuous cinematic camera move, no cuts. Continue a slow, steady forward glide toward the market observatory. Pass low beside rounded quote pylons and abstract news capsules while clay data beads flow toward the central teal intake pavilion. Use gentle foreground parallax and a subtle rise as the organized intake system is revealed. Move through the pavilion toward the evidence corridor. In the final second, settle back into a slow, steady forward glide directly into the open corridor. Preserve the exact clay materials, palette, lighting, island geometry, and miniature scale of the start frame. No text, captions, symbols, people, logos, or camera reversal.

### Clip 02 — Evidence archive

Continue from Clip 01 using Flow continuation or Clip 01's exact final frame.

> Single continuous cinematic camera move, no cuts. Continue the same slow, steady forward glide into the evidence library. Track gently beside rounded source tablets and archive shelves, with tactile citation tokens moving along clay paths toward the central periwinkle reading chamber. Pass through the chamber while keeping the visual chain from source to conclusion clear. Continue toward the multi-agent doorway. In the final second, settle back into a slow, steady forward glide through that doorway. Preserve the preceding frame's exact camera, lighting, clay materials, palette, and scale. No text, captions, symbols, people, logos, or camera reversal.

### Clip 03 — Agent synthesis

Continue from Clip 02 using Flow continuation or Clip 02's exact final frame.

> Single continuous cinematic camera move, no cuts. Continue the same slow, steady forward glide into the multi-agent research chamber. Sweep in one restrained half-orbit around four distinct clay analysis pods while their separate colored paths converge at the central synthesis table; never turn the camera backward. Continue past the table toward the amber risk gate. In the final second, settle back into a slow, steady forward glide aimed directly through the gate. Preserve the preceding frame's exact camera, lighting, clay materials, palette, and scale. No text, captions, symbols, people, logos, or camera reversal.

### Clip 04 — Risk gate

Continue from Clip 03 using Flow continuation or Clip 03's exact final frame.

> Single continuous cinematic camera move, no cuts. Continue the same slow, steady forward glide through a sequence of rounded clay risk gates. Track low beside exposure towers, valuation weights, drawdown basins, and sizing blocks as restrained ochre checks pass and only a few terracotta warnings remain. The safe center path opens toward the portfolio garden. In the final second, settle back into a slow, steady forward glide along that open path. Preserve the preceding frame's exact camera, lighting, clay materials, palette, and scale. No text, captions, symbols, people, logos, or camera reversal.

### Clip 05 — Portfolio construction

Continue from Clip 04 using Flow continuation or Clip 04's exact final frame.

> Single continuous cinematic camera move, no cuts. Continue the same slow, steady forward glide into the portfolio-construction garden. Rise gently over rounded allocation terraces while classical paths and a subtle clay quantum lattice compare combinations around asset towers. Curve around the balanced sage centerpiece without reversing direction, then continue toward the documented-decision pavilion. In the final second, settle back into a slow, steady forward glide through the pavilion entrance. Preserve the preceding frame's exact camera, lighting, clay materials, palette, and scale. No text, captions, symbols, people, logos, or camera reversal.

### Clip 06 — Documented decision

Continue from Clip 05 using Flow continuation or Clip 05's exact final frame.

> Single continuous cinematic camera move, no cuts. Continue the same slow, steady forward glide into the documented-decision pavilion. Follow the converging research paths toward one centered clay decision artifact surrounded by an unwritten thesis tablet, risk-limit tokens, journal blocks, and paper-trading markers. Make a very subtle final rise-and-reveal, then ease into a calm frontal composition. In the final second, settle into an almost imperceptible slow forward drift and hold the decision artifact cleanly for the landing-page call to action. Preserve the preceding frame's exact camera, lighting, clay materials, palette, and scale. No text, captions, symbols, people, logos, or camera reversal.

## Review and delivery

1. Approve the six concept stills for matching camera angle, island scale, clay texture, palette, and lighting.
2. Generate Clip 01 from the Signal still.
3. Inspect its final second. Reject it if the camera is orbiting, moving sideways, pulling back, or heavily motion-blurred.
4. Continue Clips 02–06 sequentially. Never start a later clip from its independent concept still.
5. Repeat the complete process separately for native 9:16 mobile media.
6. Deliver the original files without additional compression or audio:
   - `desktop/01-signal` through `desktop/06-decision`
   - `mobile/01-signal` through `mobile/06-decision`
7. The application pass will extract frame-matched posters and encode desktop H.264 at native 1080p, CRF 20/GOP 8, and mobile at 720 pixels wide, CRF 23/GOP 4.

If Flow cannot continue from an existing clip, export the exact final frame and use it as the next generation's start frame. A merely similar recreated frame is not sufficient for a seamless scroll handoff.
