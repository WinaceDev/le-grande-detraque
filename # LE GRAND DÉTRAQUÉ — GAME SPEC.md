# LE GRAND DÉTRAQUÉ — GAME SPEC

## Mission

Build a complete, genuinely playable 2D boss\-fight vertical slice for
iPhone and Android browsers\. This is not a static mockup or a single
HTML demo\. Create the actual project, run it, test it, and fix errors\.

## Creative direction

Original 1930s rubber\-hose cartoon language blended with Art Deco
theatre machinery\. The setting is an abandoned vaudeville theatre: deep
burgundy velvet, aged ivory, brass and muted gold, hand\-inked outlines,
expressive squash\-and\-stretch animation, painted scenery, layered
parallax, footlights, dust and dramatic spotlights\. Create original
characters and visual designs\. Do not copy Cuphead characters, art,
animation, names, compositions or UI\.

## Game

Title: **LE GRAND DÉTRAQUÉ**\. Setting: **Le Grand Théâtre Mécanique**\.
Hero: **Miette**, a small rebellious stagehand automaton with an
expressive face, oversized gloves and a distinct silhouette\. Boss:
**Monsieur Minuit**, an original clockwork ringmaster with a
crescent\-moon face, brass limbs, velvet coat and conductor’s baton\.

## Stack and architecture

- Phaser 3 \+ TypeScript \+ Vite\.
- Mobile\-first browser game; portrait 9:16 is the primary layout, with
  landscape and desktop adaptation\.
- Responsive scaling, iOS safe\-area support, touch and pointer input\.
- Modular scenes, entities, combat, input, UI, audio and
  configuration\.
- No runtime dependency on remote assets\.
- Provide `dev`, `build` and `typecheck` scripts\.

## Player mechanics

- Responsive left/right movement with acceleration and deceleration\.
- Jump with responsive timing; add coyote time and jump buffering if
  feasible\.
- Hold\-to\-fire primary weapon\.
- Short dash/dodge with cooldown and a brief invulnerability window\.
- Special attack charged by dealing damage, with a visible meter\.
- Collision, hit flash, knockback and temporary post\-hit
  invulnerability\.
- Clear player health display\.
- Working pause and restart\.

## Touch controls

- Direction pad or left/right buttons at bottom\-left\.
- Jump and dash at bottom\-right\.
- Hold\-to\-fire button and special\-attack button with charge feedback\.
- Large, well\-spaced targets; translucent but legible\.
- Correct multi\-touch so movement and firing/jumping can happen
  together\.
- Prevent page scrolling, text selection and browser gestures over the
  game\.
- Show a short first\-run control hint\.
- Add keyboard controls for desktop testing\.

## Boss fight: three phases

All damaging attacks must have clear visual telegraphs, readable timing
and a fair dodge opportunity\. Avoid unavoidable overlapping attacks\.

### Phase 1 — The Conductor

- Baton sweep across the floor with a visible wind\-up\.
- Falling spotlights or stage weights marked by warning
  shadows/circles\.
- Slow aimed bursts of mechanical\-note projectiles\.
- Recovery windows during which the boss can be damaged\.

### Phase 2 — The Marionette

- Boss moves between stage positions using puppet strings\.
- Bouncing gears with readable trajectories\.
- Horizontal stage\-light beam with a warning before activation\.
- Faster combinations, while remaining fair\.

### Phase 3 — Midnight Revue

- Escalated combinations of previous attacks\.
- Arena\-wide finale attack with clearly marked safe zones\.
- Brief dramatic transition and satisfying defeat animation\.

Show boss name, health bar and current phase\. Use health thresholds and
cooldowns for transitions\. Include anticipation, recoil, hit reactions
and recovery animations\.

## Arena and presentation

- Rich theatrical stage with proscenium, curtains, footlights,
  scenery, props and parallax depth\.
- Camera framing keeps hero and boss readable on narrow phones\.
- Restrained screen shake only on impactful moments\.
- Particles: sparks, dust, impact bursts, muzzle flashes and
  projectile trails\.
- Subtle film grain/vignette without harming contrast\.
- Title screen, intro, HUD, pause overlay, victory screen and
  defeat/retry screen\.

## Audio

Where feasible, add original Web Audio effects and a short original
music loop\. Include mute/unmute\. Gameplay must still work if audio is
unavailable\.

## Game flow

1. Title screen with Play and sound toggle\.
2. Short boss introduction\.
3. Playable encounter\.
4. Victory or defeat result\.
5. Retry and return\-to\-title actions\.

## Quality requirements

- Actually playable from an iPhone browser\.
- No dead buttons or fake controls\.
- No console errors during normal play\.
- Handle resize and orientation changes\.
- Legible UI on common iPhone viewport sizes\.
- Cohesive art direction; do not rely only on generic primitive
  shapes\.
- Restart works without refreshing the browser\.

## Acceptance tests

- `npm install` succeeds\.
- `npm run dev -- --host 0.0.0.0` starts the Codespaces preview\.
- `npm run build` succeeds\.
- `npm run typecheck` succeeds\.
- Touch controls support movement, jump, dash, fire and special
  attack\.
- All three boss phases work\.
- Victory, defeat and restart flows work\.
- Portrait layout does not scroll the page\.

## Instructions to Codex

1. Read this file before coding\.
2. Inspect the repository\.
3. Implement the complete vertical slice, not merely a plan or static
   HTML\.
4. Create all source files, configuration and required local assets\.
5. Install dependencies; run typecheck and production build; fix all
   errors\.
6. Start the dev server bound to `0.0.0.0` for Codespaces port
   forwarding\.
7. Report the forwarded port and exact iPhone preview steps\.
8. Do not claim a feature is complete unless it is implemented and
   tested