# ORBIT design system

Owner: Arham. The tokens live in `src/styles/tokens.css` (the only place raw values may appear). The primitives live in `src/ui/`.

**Direction:** deep black, electric cyan, amber/orange accents. Effects sit between subtle and cinematic: sleek, not busy. Futuristic, cinematic, clean, like an
intelligence centre. The globe is the hero, and panels float over it as dark glass.

## Tokens

### Colour

| Token                                                      | Use                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `--color-bg`, `--color-bg-elevated`                        | Page background, raised areas                         |
| `--color-surface`, `--color-surface-hover`                 | Glass panels (semi-transparent over the globe)        |
| `--color-border`, `--color-border-strong`                  | Hairlines, focused/active outlines                    |
| `--color-text`, `--color-text-muted`, `--color-text-faint` | Primary, secondary, tertiary text                     |
| `--color-primary`, `--color-primary-dim`                   | Electric cyan: links, focus, geopolitical             |
| `--color-accent`                                           | Amber: Ask ORBIT, health, highlights                  |
| `--color-alert`                                            | Orange: critical, errors                              |
| `--color-success`, `--color-danger`                        | Status only                                           |
| `--severity-1` … `--severity-5`                            | The shared 1–5 severity scale (cyan → amber → orange) |
| `--kind-geopolitical`, `--kind-health`                     | Event kind colours                                    |
| `--globe-*`                                                | Ocean, land, hover, selected, borders, atmosphere     |

### Typography

| Token                               | Value                                       |
| ----------------------------------- | ------------------------------------------- |
| `--font-display`                    | Space Grotesk: headings, brand              |
| `--font-body`                       | Inter: body text                            |
| `--font-mono`                       | JetBrains Mono: labels, numbers, badges     |
| `--text-xs` … `--text-3xl`          | 0.75rem → 2.75rem scale                     |
| `--weight-regular/medium/bold`      | 400 / 500 / 700                             |
| `--tracking-label`                  | Letter spacing for uppercase eyebrow labels |
| `--leading-tight`, `--leading-body` | Line heights                                |

Fonts load from Google Fonts. Offline, they fall back to Segoe UI / Consolas, so the demo still reads well.

### Spacing, borders, radii

- Spacing on a 4px grid: `--space-1` (4px) … `--space-8` (64px).
- `--border-width` (1px). Radii: `--radius-sm` 4px, `--radius-md` 8px, `--radius-lg` 14px (panels), `--radius-pill`.

### Glass panels

`--glass-bg` (gradient fill), `--glass-border`, `--glass-highlight` (inner top highlight), `--glass-accent-border` (amber
variant). Panels are dark glass: translucent, blurred, thin cyan hairline, 14px radius.

### Shadows and glows

`--shadow-panel` (panel depth), `--glow-primary` (cyan), `--glow-accent` (amber), `--glow-alert` (orange), `--glow-soft` (panel hover), `--blur-panel`
(glass blur). Use glows sparingly: for focus, hover and severity 5 only.

### Motion and layers

- `--duration-fast/base/slow` (150/250/600ms) with `--ease-out`. `--duration-layout` (700ms) with `--ease-inout` for the
  globe squeeze between the global and detail views. They all become 0 when the user prefers reduced motion.
- `--z-globe` < `--z-overlay` < `--z-panel` < `--z-modal`.
- Layout sizes: `--panel-width` (420px, right column), `--center-width` (760px, detail view), `--mini-globe-size` (220px),
  `--drawer-width` (420px, Ask ORBIT drawer), `--topbar-height` (56px).

## Primitives (`src/ui`, import from `../../ui`)

| Component       | Use                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Panel`         | Every overlay section (glass). Props: `eyebrow`, `title`, `actions`, `tone` (`default`                                  | `accent` for AI content), `children` |
| `QueryState`    | Renders loading / error / data for a TanStack query: `<QueryState query={q} label="country">{(data) => …}</QueryState>` |
| `Loader`        | Loading state (`role="status"`)                                                                                         |
| `ErrorState`    | Error state with optional retry (`role="alert"`)                                                                        |
| `ErrorBoundary` | Wrap each feature section so a crash stays contained                                                                    |
| `ItemList`      | Vertical list with dividers and a required empty state                                                                  |
| `SeverityBadge` | Shows severity 1–5 with its colour and label (severity 5 pulses slowly)                                                 |

| `Button` | Variants `primary` (cyan), `accent` (amber: Ask ORBIT, AI), `ghost`. Sizes `sm`, `md`. `iconOnly` requires `aria-label` |
| `Tag` | Small uppercase pill. `kind` (`geopolitical` / `health`) colours it; without `kind` it is neutral |

New primitives are decided with Arham (the design decision owner).

## Common UI states (every data view needs all four)

| State   | How                                                  |
| ------- | ---------------------------------------------------- |
| Loading | `QueryState` / `Loader`                              |
| Error   | `QueryState` / `ErrorState` (with retry)             |
| Empty   | `ItemList` `empty` text, or a sentence in muted text |
| Success | The content                                          |

## Conventions

- One `Component.module.css` next to each component. Class names are camelCase (`styles.askButton`).
- Only tokens: `color: var(--color-text-muted)`, never `#8aa0b8`. The same goes for spacing, radii and shadows.
- Canvas/WebGL (globe): read tokens with `cssVar('--globe-land')` and `severityColor(severity)` from `src/styles/cssVar.ts`.
- Animations: define `@keyframes` inside the component's own `.module.css` (CSS Modules rename keyframes, so global ones can't be referenced).
- Text: sentence case. Eyebrow labels are uppercase via CSS, not typed in capitals.
- Accessibility: visible focus (global `:focus-visible` ring), `aria-label` on icon-only buttons, and colour never the only signal
  (severity badges also show the label and number).
- Numbers: `toLocaleString()` for large values. Dates: show them at their `datePrecision`.
