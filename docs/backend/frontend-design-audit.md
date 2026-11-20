# Neeva AI — Read-Only Frontend Design System Audit

**Audit Mode:** Strictly Read-Only (0 files modified in `frontend/`)  
**Reference Files Inspected:**
- `frontend/src/styles.css`
- `frontend/src/routes/__root.tsx`
- `frontend/src/routes/index.tsx`
- `frontend/src/components/neeva/AppShell.tsx`
- `frontend/src/components/neeva/Card.tsx`
- `frontend/src/components/neeva/CrisisDialog.tsx`
- `frontend/src/components/neeva/SecurityBanner.tsx`

---

## 1. Visual Language & Design Philosophy

Neeva's visual aesthetic is **"Warm Editorial Pocket Sticker"** — combining a tactile, warm paper background (`#FAF7F0` / `oklch(0.977 0.011 88)`), deep forest-green ink outlines (`--ink: oklch(0.27 0.045 155)`), soft pastel cards (sage, rose, lilac, periwinkle, sand), and a high-contrast electric lime-yellow accent (`--zest: oklch(0.92 0.17 118)`).

Key tactile signatures:
- **Chunky Sticker Outlines (`.pop`)**: `1.5px solid var(--ink)` with hard offset drop shadows (`3px 3px 0 0 var(--ink)` for standard elements and `6px 6px 0 0 var(--ink)` for hero/featured cards).
- **Physical Button Press (`.press`)**: Hovering shifts the button `translate(-1px, -1px)` and expands the shadow to `4px 4px 0 0 var(--ink)`; active press pushes it down `translate(2px, 2px)` with `0 0 0 0` shadow.
- **Zest Highlighter (`.highlight`)**: Inline text underline gradient (`linear-gradient(transparent 58%, var(--zest) 58%, var(--zest) 92%, transparent 92%)`).
- **Subtle Film Grain (`.grain`)**: SVG `feTurbulence` fractal noise overlay at `0.07` opacity (`mix-blend-mode: multiply`).

---

## 2. Typography System

Loaded from Google Fonts in `frontend/src/routes/__root.tsx`:
- **Primary Sans (`--font-sans`)**: `"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`
  - Used for body copy, buttons, cards, and bold display headings (`font-extrabold tracking-tight`, line-height `0.92` to `1.15`).
- **Editorial Display Serif (`--font-display`)**: `"Instrument Serif", ui-serif, Georgia, serif`
  - Used for italic emotional emphasis inside headings (e.g., `<em class="font-display font-normal italic">every pocket.</em>`).
- **Technical Monospace (`--font-mono`)**: `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace`
  - Used for uppercase section eyebrows (`text-xs font-bold uppercase tracking-wider`), price pills (`₹99/month`), route indicators (`/today`, `/checkout`), and badges.

---

## 3. Color Palette (OKLCH & Hex Equivalents)

| Token | OKLCH Definition (`styles.css`) | Hex Approximation | Usage |
|---|---|---|---|
| `--background` | `oklch(0.977 0.011 88)` | `#FAF7F0` | Warm cream page canvas |
| `--card` | `oklch(0.993 0.006 88)` | `#FFFDF8` | Elevated card surface |
| `--ink` / `--foreground` | `oklch(0.27 0.045 155)` | `#183024` | Deep forest ink text, borders (`1.5px`), and offset shadows |
| `--primary` | `oklch(0.29 0.045 152)` | `#1B3628` | Primary dark green fills |
| `--muted` | `oklch(0.948 0.013 85)` | `#F1ECE1` | Subtle pill/input background |
| `--muted-foreground` | `oklch(0.47 0.03 160)` | `#50655A` | Secondary captions & eyebrows |
| `--zest` | `oklch(0.92 0.17 118)` | `#DDF247` | Signature lime-yellow CTA & price badge fill |
| `--zest-foreground` | `oklch(0.27 0.05 150)` | `#183123` | Text on zest badges/buttons |
| `--sage` | `oklch(0.9 0.03 145)` | `#D8E6D9` | Calm/wellness card tint |
| `--rose` | `oklch(0.89 0.03 55)` | `#F2DDD0` | Pricing & warmth card tint |
| `--lilac` | `oklch(0.895 0.04 305)` | `#E6DCF2` | Interactive/companion card tint |
| `--periwinkle` | `oklch(0.86 0.03 270)` | `#D4DAF0` | Sleep/rest card tint |
| `--sand` | `oklch(0.955 0.02 85)` | `#F3EDE0` | Section band background |
| `--crisis` | `oklch(0.6 0.16 28)` | `#D94E34` | Crisis helpline badge & alert states |

---

## 4. Component & Layout Patterns

- **Cards & Panels (`Panel` in `Card.tsx`)**:
  - Border radius: `rounded-[1.75rem]` (`28px`) or `rounded-[2rem]` (`32px`) for hero panels.
  - Border: `1.5px solid` (`border-ink` for active/featured cards; `border-ink/15` transitioning to `border-ink/40` on hover for secondary cards).
  - Padding: `p-5` (`20px`) to `p-8` (`32px`).
- **Buttons & Pills**:
  - Full pill radius (`rounded-full`).
  - Height: `h-10` (`40px`) in navbar, `h-12` (`48px`) for primary CTAs.
  - Combined `.pop .press` utility classes for tactile offset shadow and press animation.
- **Sticky Glass Header**:
  - `sticky top-0 z-40 border-b-[1.5px] border-ink/10 bg-background/85 backdrop-blur-xl`
  - Contains brand mark, lowercase `neeva` wordmark (`font-extrabold tracking-tight`), monospace route badge, and pill actions.
- **Footer Security Banner**:
  - Bottom reassurance bar highlighting on-device privacy, AES-GCM encryption, and 24×7 Tele-MANAS `14416` crisis support.

---

## 5. Application to the Standalone `/payment-demo/` Project

To ensure the isolated `/payment-demo/` experience looks and feels 100% native to Neeva without importing or touching any file in `frontend/`:
1. Load **Plus Jakarta Sans**, **Instrument Serif**, and **JetBrains Mono** from Google Fonts.
2. Define the exact OKLCH CSS variables (`--background`, `--card`, `--ink`, `--zest`, `--sage`, `--rose`, `--lilac`, `--periwinkle`, `--sand`, `--crisis`) and `.pop`, `.press`, `.highlight`, and `.grain` utilities inside `/payment-demo/`.
3. Use the signature `rounded-[2rem]` `1.5px solid var(--ink)` cards with `3px 3px 0 0 var(--ink)` and `6px 6px 0 0 var(--ink)` shadows, monospace eyebrows, and italic Instrument Serif accents across plan selection, coupon calculation, fictional checkout, simulated processing, success, failure, and retry states.

