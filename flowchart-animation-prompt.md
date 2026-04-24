---
description: Generic prompt for converting any flowchart/data-flow diagram into an animated, self-contained HTML file
---

# Animated Flowchart / Data-Flow Diagram — Generic Prompt

> **Usage:** Copy this prompt into an LLM conversation. Replace the `## Diagram Description` section with your own nodes, edges, groups, and layout. The rest of the spec is reusable as-is for any diagram.

---

## Role

You are a senior creative front-end engineer specialising in professional data-flow visualisation, SVG animation, and UI/UX polish.

## Task

Convert the architecture/data-flow diagram I describe below into a single, self-contained HTML file. The output must feel like a polished product demo — dark-themed, smooth, and visually impressive — not a prototype or a tutorial example.

---

## Diagram Description

> **⬇ REPLACE THIS ENTIRE SECTION with your own diagram. Follow the format below.**

### NODES

Each node is an object with:

| Field | Description |
|-------|-------------|
| `id` | Unique string identifier |
| `label` | Display text |
| `x`, `y` | Approximate position on the SVG canvas |
| `shape` | `"box"` (rect), `"diamond"` (rotated square), `"pill"` (rounded rect), `"roundedBox"` |
| `colorKey` | One of: `"default"`, `"gateway"`, `"decision"`, `"success"`, `"error"` |
| `group` | *(optional)* ID of the group this node belongs to |

**Example:**

```
NODES:
- "A1", "A2", "An" — small boxes inside a dashed "Sensors" group (left side)
- "Scanner" — box below the Sensors group, also inside the outer container
- "API Gateway" — blue box inside a right-side container
- "CAS" — blue box below API Gateway, same container
- "SAS" — teal diamond (decision node), below the right container
- "Landing Service" — green rounded box, below SAS
- "401 Unauthorized" — red/pink pill, to the right of SAS
```

### CONTAINERS / GROUPS

Each group wraps related nodes visually.

| Field | Description |
|-------|-------------|
| `id` | Unique string identifier |
| `label` | Text label shown below or above the group |
| `contains` | Array of node IDs or nested group IDs |
| `style` | `"solid"` or `"dashed"` |

**Example:**

```
CONTAINERS / GROUPS:
- Outer left container: holds Sensors group + Scanner
- Inner dashed container: holds A1, A2, An; labelled "Sensors" below
- Right container: holds API Gateway + CAS
```

### EDGES (arrows)

Each edge connects two nodes with an optional label.

| Field | Description |
|-------|-------------|
| `id` | Unique string identifier |
| `from` | Source node ID |
| `to` | Target node ID |
| `label` | *(optional)* Edge label text |
| `curve` | `true` for a curved path, `false` for straight |

**Example:**

```
EDGES (arrows):
- A1, A2, An, Scanner → API Gateway (convergent arrows, label "request")
- API Gateway → CAS (internal)
- CAS → SAS (downward)
- SAS → Landing Service (downward, label "Accept")
- SAS → 401 Unauthorized (rightward, label "Reject")
```

---

## Layout

Faithfully reproduce the spatial layout of the original diagram using SVG. Nodes must be at approximately the same relative positions as in the source diagram.

The SVG canvas must be centred on the page and scale responsively on window resize without breaking positions or proportions.

---

## Animation Requirements — QUALITY BAR: Production-grade, no jank

### 1. Particle / Data-packet Flow — smooth & physically believable

- Animate small circular "data packets" (8–10 px diameter) that travel along each edge path.
- Motion MUST use a cubic ease-in-out (or custom cubic-bezier) — never linear. Linear motion looks robotic and is not acceptable.
- Use `requestAnimationFrame` with a high-resolution timestamp (`performance.now()`) for perfectly smooth 60 fps motion — do NOT use `setInterval` or CSS animation for packet movement, as they stutter on complex paths.
- Stagger multiple packets per edge (100–200 ms offset between each) so they feel like a continuous, organic data stream, not a mechanical queue.
- Each packet should have a radial gradient fill (bright core → transparent edge) and an SVG `<feGaussianBlur>`-based glow filter to make it look luminous, not flat.
- The trailing edge of each packet may leave a short fading "comet tail" (3–4 smaller ghost dots at decreasing opacity) for a premium motion feel.

### 2. Node Processing / Computation Loading State — professional, not a spinner

- When a packet arrives at a node, do NOT show a generic CSS spinner. Instead, use ONE of the following to convey computation:

  a) An animated SVG arc that "fills up" like a progress ring (`stroke-dashoffset` from full circumference → 0), paired with a subtle node background pulse from the node's base colour → a brighter tint → back.

  b) A brief "binary/hex ticker" text animation inside the node (digits rapidly cycling through 0-9/A-F), stopping when processing is done — this communicates that data is being processed.

  c) A radial "ripple" emanating from the node centre (2–3 concentric rings expanding and fading out), like sonar, conveying signal processing.

- The chosen effect must last 700–900 ms for regular nodes and 1000–1200 ms for decision/gateway nodes.
- After processing ends, transition the node back to its idle state with a smooth ease-out fade (200 ms), not a sudden snap.
- The arrival of a packet must also animate the node border: briefly glow/intensify the border colour, then ease back.

### 3. Edge Activation — cinematic highlight

- When a packet is on an edge, animate the edge's stroke with a flowing `stroke-dashoffset` shift (the "marching ants" / "racing stripe" effect) in the active edge colour.
- Additionally apply a subtle SVG glow filter (`feGaussianBlur` + `feComposite`) to the active edge stroke so it appears to "light up."
- Use a smooth 200 ms CSS transition on opacity and filter when edges activate and deactivate — no abrupt toggling.
- Idle edges must be clearly dimmer (opacity ~0.35) so active edges stand out strongly.

### 4. Branching / Conditional Paths

- For decision nodes with multiple outgoing edges, play BOTH branches in sequence during auto-play: first the Accept/success path, pause 1 s, reset that branch, then play the Reject/failure path. This makes both outcomes legible.
- Label the edges ("Accept", "Reject") with a small pill badge that briefly highlights (background flash) when that path is activated.

### 5. Transitions & Timing — no abrupt jumps anywhere

- Every state change (idle → active → processing → idle) must be a smooth interpolated transition. Zero abrupt opacity or position jumps.
- Use a shared `TIMING` config object (see Editable Data Structure) so all durations scale together when speed is changed.
- Between loops in auto-play, fade out all active elements over 400 ms before resetting, rather than instantly clearing.

---

## Controls — polished UI, not raw buttons

### Control Bar

- Place a pill-shaped control bar at the bottom-centre of the page (fixed position, dark glassmorphism style: `background: rgba(255,255,255,0.06); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12)`).
- Buttons inside the bar: **▶ Play**, **⏸ Pause**, **↺ Reset**, **⏭ Step**.
- Buttons must have hover states (slight background brightening, `cursor: pointer`) and active/pressed states (slight scale-down: `transform: scale(0.95)`).
- A **speed control** — a segmented button group (`"0.5× · 1× · 2×"`), not a slider — sits to the right of the main buttons.
- A **mode toggle pill** (`"Auto ↔ Step"`) sits to the left.

### Auto-Play Mode

- ▶ Play starts the full animation from all source nodes, in correct topological order.
- After one full pass, pause 1.5 s then loop, with a fade-out/fade-in between loops.
- ⏸ Pause freezes all `requestAnimationFrame` loops mid-frame; ▶ resumes from exactly the same point.

### Step Mode

- Each press of ⏭ Step fires exactly one data packet from the next source node in sequence.
- Clicking directly on any node in Step mode triggers that node's processing animation and highlights its outgoing edges.
- A subtle tooltip appears above a clicked node showing its label and "Processing…" / "Idle" status.

---

## Visual Style — Dark Theme, Professional Palette

### Colour System

**All colours below are mandatory defaults. Do not substitute with flat or light alternatives.**

| Element | Colour |
|---------|--------|
| Page background | `#0d1117` (GitHub-dark style near-black) |
| SVG canvas background | `#0d1117` (same, no visible canvas border) |
| Container / group fill | `rgba(99, 120, 180, 0.10)` with `1.5px solid rgba(99,120,180,0.30)` border |
| Dashed inner group | `rgba(99, 120, 180, 0.06)` with `1.5px dashed rgba(99,120,180,0.40)` |
| Regular node fill | `#1c2333` with `1.5px solid #30415a` border |
| Node label text | `#c9d1d9` (soft white, not pure `#fff`) |
| Gateway / API nodes | Fill `#162032`, border `#2f81f7` (GitHub blue) |
| Decision diamond | Fill `#0e2a2a`, border `#3fb950` (success green) when neutral; border pulses to `#58d68d` during processing |
| Success/accept terminal node | Fill `#0e2a1a`, border `#3fb950`, label `#3fb950` |
| Error/reject terminal node | Fill `#2a0e0e`, border `#f85149`, label `#f85149` |
| Idle edge stroke | `rgba(48, 65, 90, 0.6)` |
| Active edge stroke | `#2f81f7` (matches gateway blue, feels like signal) |
| Data packet core | `#ffffff` |
| Data packet glow | `#2f81f7` (blue glow, `stdDeviation="4"`) |
| Control bar background | `rgba(13,17,23,0.85)` + `backdrop-filter: blur(16px)` |
| Control bar border | `rgba(48,65,90,0.6)` |
| Button default | `rgba(48,65,90,0.5)` background, `#c9d1d9` text |
| Button hover | `rgba(47,129,247,0.2)` background, `#2f81f7` text |
| Button active segment | `#2f81f7` background, `#fff` text |
| Font | Inter (import from Google Fonts CDN) |

### Typography

- Node labels: `13px`, font-weight `500`, letter-spacing `0.02em`.
- Edge labels / badge pills: `11px`, font-weight `600`, uppercase.
- Control bar labels: `12px`, font-weight `500`.

### General Polish Rules (MUST follow)

1. All SVG elements that represent nodes must have `rx="8"` (rounded corners) except diamonds — diamonds use a rotated square (`transform="rotate(45)"`).
2. Apply an `<feDropShadow>` SVG filter to every node (`dx=0, dy=2, stdDeviation=4`, flood-color matching the node's border colour at 40% opacity) to give subtle depth.
3. The page title (diagram name) must appear at the top in `#c9d1d9`, `18px`, font-weight `600`, letter-spacing `0.05em` — no other header decoration.
4. Do not use any CSS gradients on node fills — use flat semi-transparent fills only. Gradients make small nodes look cluttered.
5. SVG arrowheads must use `<marker>` elements with fill matching the edge's active or idle stroke colour respectively.

---

## Technical Constraints

- Output a **SINGLE self-contained HTML file**.
- Use **Vanilla JS + CSS**. You MAY import: (a) Inter font from Google Fonts, (b) ONE animation library — **GSAP** (cdnjs) is preferred for its precise `gsap.to()` timeline control; if not using GSAP use pure `requestAnimationFrame`. No other CDN imports.
- No frameworks (no React, Vue, Svelte, etc.).
- No external image assets — draw all shapes with inline SVG.
- Must open correctly by double-clicking in a browser (`file://` protocol, no server).
- Code must be structured: SVG markup first, then a `<script>` block with clearly separated sections: (1) graph data, (2) render functions, (3) animation engine, (4) control handlers.
- Add concise comments at the start of each section.

---

## Editable Data Structure

At the very top of the `<script>` block, define the entire graph and all timing as plain JS config objects so the diagram can be swapped without touching the animation engine:

```js
// ─── GRAPH DATA (edit this to change the diagram) ───────────────────────
const NODES = [
  { id: "a1", label: "A1", x: 100, y: 130, shape: "box", colorKey: "default", group: "sensors" },
  // ...
];

const EDGES = [
  { id: "e1", from: "a1", to: "apiGateway", label: "request", curve: false },
  // ...
];

const GROUPS = [
  { id: "outerLeft", label: "", contains: ["sensors","scanner"], style: "solid" },
  // ...
];

// ─── TIMING CONFIG (scale all durations by changing speedMultiplier) ─────
const TIMING = {
  speedMultiplier: 1,        // changed by speed buttons
  packetDuration: 1200,      // ms to traverse one edge at 1×
  processingDuration: 800,   // ms for node computation animation
  decisionDuration: 1100,    // ms for decision node computation
  staggerDelay: 160,         // ms between packets on the same edge
  loopPause: 1500,           // ms between auto-play loops
};
```

---

## Checklist (for the LLM to self-verify before outputting)

- [ ] Single HTML file, no external assets beyond Google Fonts + optional GSAP CDN
- [ ] All nodes, edges, groups rendered in SVG at correct relative positions
- [ ] Responsive SVG scaling (viewBox + preserveAspectRatio)
- [ ] Data packets animate with eased motion (no linear), glow filter, comet tail
- [ ] Node processing animation is NOT a spinner — uses ring-fill, hex ticker, or ripple
- [ ] Edges dim when idle, glow when active, with marching-ants dash animation
- [ ] Decision node plays both branches sequentially
- [ ] Control bar: Play, Pause, Reset, Step, Speed (0.5×/1×/2×), Mode (Auto/Step)
- [ ] All transitions are smooth (200–400 ms eases), no abrupt state changes
- [ ] Dark theme colours match the mandatory palette table exactly
- [ ] TIMING config object is at the top of the script and controls all durations
- [ ] Code is structured with clear section comments
