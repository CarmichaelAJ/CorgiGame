# Corgi Game

Full-screen browser game built with React, TypeScript, Vite, and Phaser.

## What is in this build

- Responsive full-screen Phaser game canvas for phones, iPads, and laptops.
- Tap/click/space/enter to start, jump, and retry.
- Smooth circular day, sunset, night, moon, stars, and snow phases.
- Snack pickups that trigger a temporary score/visual bonus while run speed stays constant.
- Rare sombrero pickup that triggers 7.5 seconds of fiesta mode.
- Fiesta mode pauses obstacle spawning and adds fireworks/confetti.
- Distance-guarded obstacle spawning so jumps have a reachable recovery window.
- Local best score saved in `localStorage`.
- Fresh generated source sheets in `public/assets/source`.
- Extracted generated PNG sprites for corgi poses, snacks, obstacles, sombrero, and background elements in `public/assets/sprites`.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The Vite base path is relative, so the `dist` output can work on Vercel or under a GitHub Pages repo path.

## GitHub Pages

Pushes to `main` run `.github/workflows/pages.yml`, build the Vite app, and publish `dist` to GitHub Pages.

## Extract sprites

The sprite extraction script crops transparent PNGs from the generated chroma-key source sheets:

```bash
npm run assets:extract
```

It requires Python with Pillow available.
