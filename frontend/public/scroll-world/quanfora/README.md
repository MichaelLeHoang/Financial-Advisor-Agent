# Quanfora clay scroll world

The landing page uses four independent autoplay clips on desktop, with the video on the left and the active narrative on the right. Each clip restarts when its scene becomes active so the scene has a distinct entrance. Mobile and reduced-motion visitors receive the complete static four-step journey.

## Playback assets

- `first-scene.mp4` supplies the complete Signal scene.
- `seconde-scene.mp4` supplies the complete Agents scene.
- `third-scene.mp4` supplies the complete Risk scene.
- `fourth-scene.mp4` supplies the complete Decision scene.
- The scene builder replaces border-connected checker pixels with matte `#07080B`, then creates silent, fast-start H.264 clips and first-frame JPEG posters. The already-opaque fourth scene is preserved as supplied.

Build the four clips from the frontend directory:

```bash
./scripts/build-scroll-world-scenes.sh
```

Optional arguments replace the four source paths in order; a fifth argument changes the output directory. The build requires `ffmpeg`, `ffprobe`, Python 3, Pillow, NumPy, and SciPy.

## Replacement-media brief

Future source media should be exported at native 16:9 over a real matte `#07080B`. H.264 does not carry alpha, so a transparency checkerboard must never be rendered into the frames. Use one clay-diorama treatment, camera language, palette, and lighting setup across all four scenes.

The story order is:

1. Signal — market intake and organized source streams.
2. Agents — distinct specialist perspectives converging on a synthesis.
3. Risk — exposure, valuation, drawdown, and sizing checks.
4. Decision — a documented thesis, risk limits, journal, and paper-trading next step.

For a future native mobile version, generate a separate 9:16 composition rather than cropping the desktop film. Keep important visual detail in the upper 60% and reserve dark negative space for the HTML narrative.

## Delivery checks

- 1280×720 or higher, 24 fps, silent, no embedded checkerboard.
- No text, captions, watermarks, logos, or interface labels inside the film.
- Each scene starts with a settled composition suitable for its float-up text entrance.
- No cuts inside an individual scene.
- Confirm all four posters match their clip's first frame.
