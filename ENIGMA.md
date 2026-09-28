# ENIGMA

**A seven-section, scroll-driven fashion-model portfolio. No framework, no build
step, no dependencies — seven HTML sections, seven CSS files, seven JS files, and
a folder of photographs.**

This file is the guide. It covers, in order: what is built, how to run it, the
flow the scroll drives, the three rules every section obeys, every asset and
where it came from, **the prompts that produced it**, and the verification loop
used to check the work against the references.

Read *The three rules* before changing anything. Every section is written to
them, and a change that breaks one of them will look fine in isolation and wrong
in the film.

---

## Table of contents

- [What is built](#what-is-built)
- [Run it](#run-it)
- [The flow](#the-flow)
- [The three rules](#the-three-rules)
- [Section by section](#section-by-section)
- [The assets](#the-assets)
- [Replacing the placeholders](#replacing-the-placeholders)
- [The prompts](#the-prompts)
- [The verification loop](#the-verification-loop)
- [Responsive, reduced motion, accessibility](#responsive-reduced-motion-accessibility)
- [File map](#file-map)
- [What is still placeholder](#what-is-still-placeholder)

---

## What is built

A single page. `index.html` holds all seven sections; each section owns exactly
one CSS file and one JS file, and no section reads another's internals. The whole
site is static — serve the folder and it runs.

```
01  #hero      the cinematic entrance          hero.css    hero.js
02  #archive   the archive room                space.css   space.js
03  #folio     the floating portfolio          folio.css   folio.js
04  #looks     model in focus                  looks.css   looks.js
05  #behind    one look, four moods            behind.css  behind.js
06  #story     behind the scenes               story.css   story.js
07  #finale    the final scene                 fin.css     fin.js
```

Nothing here generates artwork. The ENIGMA wordmark on screen is the supplied
`TITTLE.jpg` — flat red on pure black — recoloured live in the browser by one SVG
`feColorMatrix` that maps the source **red channel to alpha** and paints the
sampled reference ink `rgb(206,1,15)`:

```
0     0 0 0 0.8078
0     0 0 0 0.0039
0     0 0 0 0.0588
1.30  0 0 0 -0.130
```

That is why the wordmark composites over the photograph with no black box and no
halo. Replace the asset and the filter still works, as long as the replacement is
red on black.

---

## Run it

Any static server. The project ships a launch config for one:

```bash
python -m http.server 5173
```

Then open `http://localhost:5173`. `.claude/launch.json` declares the same server
under the name `enigma-hero`.

Do **not** open `index.html` over `file://`. The self-hosted font and the
fallback-image probing both need real HTTP.

---

## The flow

Scroll is the film. Every section past the hero is a pure function of the page's
scroll position, so the whole page plays forward and rewinds exactly.

| # | id | scroll runway | what the scroll actually does |
|---|---|---|---|
| 01 | `#hero` | `100vh` | **nothing.** The entrance is a timed sequence, ~3.9s from first paint |
| 02 | `#archive` | `100vh` | feeds inertia into the room's spin and dollies the camera through the volume |
| 03 | `#folio` | `340vh` | advances `t` around the ellipse — screens enter left, swell, rake away right |
| 04 | `#looks` | `370vh` | turns the tilted ring through four stations, one per mood |
| 05 | `#behind` | `360vh` | carries prints along measured waypoints — one leaves as the next arrives |
| 06 | `#story` | `340vh` | pulls one frame forward off the four-frame row; the others settle back |
| 07 | `#finale` | `220vh` | runs the closing timeline: atmosphere, mark, copy, nav, socials, baseline |

About `1830vh` of document in total. Sections 03–07 pin a `100vh` stage with
`position: sticky` inside a tall outer block; the tall block exists only to give
the scroll something to push against, so what you see is one continuous room
rather than a page scrolling past.

Section 02 is the exception — a flat `100vh` with no runway. It reacts to the page
scrolling *through* it rather than owning a runway of its own, and it is the only
section you can also **drag**.

Every in-page link carries `data-scroll` and is smooth-scrolled by `space.js`,
which owns the one global scroll handler for the page.

---

## The three rules

### 1 · Scroll is the only motor

Every section past the hero derives its state from one scalar, and that scalar is
read from the scroll position on every frame. Nothing keeps animation state the
scroll cannot reproduce, which is why reversing the scroll replays a hand-off
backwards exactly rather than restarting it.

Sections 05 and 06 are the strict form: the arrow buttons and clicking a waiting
print call `scrollToState()`, which animates the *page's* `scrollTo`. There is no
second animation system to fall out of sync — the control moves the scroll, and
the scroll moves the section.

Sections 02 and 03 are the relaxed form, and it is worth knowing exactly how they
differ. Section 03 keeps a `manual` offset and rebuilds its target as
`scrollBase() + manual`; the arrows add `±42` to it (two screens) and drag pushes
it directly. Section 02 lets drag write the spin and lets scroll feed *inertia*
into it. In both cases the offset persists, so the section is a pure function of
scroll **plus** that offset — position is still fully derived, but it is no longer
recoverable from the scrollbar alone.

The corollary matters when you extend this: **never animate a section's state
directly.** Either move the scroll, or move the one offset the section already
derives from — never introduce a third thing that ticks on its own.

### 2 · One reference pixel

Each section declares a unit equal to one pixel of the reference image it was
measured from, and every geometric value is a multiple of it:

| section | reference | frame | unit |
|---|---|---|---|
| 01 | `ACTUAL REFRENCE.jpg` | 1536 × 1024 | `--u` |
| 02 | `REFRENCE IMAGE FOR SECTION 2.jpg` | 1200 × 753 | `--au` |
| 03 | `Section 3 refrence.jpeg` | 1536 × 1024 | `--u` |
| 04 | `Section 4 refrence.jpg` | 1536 × 1024 | `--u` |
| 05 | `Section 5 refrence.jpg` | 1536 × 839 | `--u` |
| 06 | `section 6 refrence.jpg` | 1536 × 1024 | `--u` |

```css
--u: clamp(0.44px, min(0.0651042vw, 0.09765625vh), 2.2px);
```

The `min(vw, vh)` is the important half. It scales the composition to whichever
axis is *tighter*, so the layout stays contained and the vertical rhythm never
breaks — the alternative, scaling on width alone, shears the composition apart on
a short window.

Because of this, geometry lives in each JS config as **reference-frame numbers**
(`w: 559, h: 793`), not as CSS sizes. Add a photograph and the geometry does not
move: the slot's world size was fixed when it was measured.

### 3 · Compositor-only motion, and idle is genuinely still

Only `transform` and `opacity` animate. Nothing animates `filter`, `width`, `top`,
or anything else that forces layout or paint.

Every section's `requestAnimationFrame` loop glides its value toward a target and
then **shuts itself off** once everything has settled. A page sitting idle at the
bottom of section 04 is not burning a frame loop. If you add motion, add it to the
existing loop and add its settle condition to the shutdown test.

One 3D caveat that costs an afternoon if you hit it cold: `opacity` and `filter`
collapse `transform-style: preserve-3d` to flat. That is why nothing between
`.space__room` and an individual `.pan` is ever faded — depth, reveal and exit all
fold into each panel's own `--o`.

---

## Section by section

Every JS file opens with a numbered block labelled *"the only part you normally
need to touch"*. That block is the section's config. The geometry below it was
measured, and should not be edited casually.

### 01 · Hero — the cinematic entrance

`hero.js` runs a fixed timeline in milliseconds from first paint. Frame numbers
refer to the original brief:

```
   0  black      pure darkness
 300  bg         colour atmosphere
 900  girl       the portrait emerges, then settles
1700  title      ENIGMA rises
2680  copy       supporting editorial text
2900  date       the red accent line
3000  header     nav, staggered left / centre / right
3540  bts        selected-work link
3610  edn        based in Paris
3680  rail       the vertical rail
3730  footer     three lines, staggered 60ms apart
3900  secnav     section navigation
```

Five easings carry it, and none of them overshoot — an elastic curve reads as UI,
and this is meant to read as film:

```
atmos  cubic-bezier(.33,0,.15,1)    colour emerging from black
photo  cubic-bezier(.16,1,.3,1)     the print developing
lift   cubic-bezier(.19,1,.22,1)    the title being lifted
fine   cubic-bezier(.22,.61,.36,1)  editorial text
settle cubic-bezier(.4,0,.2,1)      micro settle
```

The document carries `data-state` — `preload` → `intro` → `live`. Pointer parallax
only engages at `live`, so the entrance is never disturbed by a cursor that
happens to be moving.

The portrait is stacked twice, soft under sharp, so it can *develop* rather than
fade in.

### 02 · The archive room

A **volume**, not a carousel. Screens sit at arbitrary `(angle, radius, y)` inside
a rectangular room that turns about a vertical axis `D` in front of the camera:

```
[ angle°, radius, y, width, ownYaw°, tilt° ]
```

Radius runs ~450 → 1600, so a panel's nearest pass renders up to **1.44×** and its
farthest at **~0.29×**. That 5:1 spread — not the rotation — is what reads as
depth. No two screens share an orbit, so the cylinder never resolves into a ring.

The outer-shell panels sweep closest to the camera, so every one of them carries a
large `|y|`: they pass above or below the central corridor and never block the
view into the room.

Each panel counter-rotates the room's spin so that it broadly faces the camera.
Both the spin and every counter-rotation ride **one inherited `--spin` custom
property**, so the whole room costs one variable write per frame.

Config: `SETS` (folder, count, extension), `OPS` (per-image `object-position`, so no
face is lost in the 4:3 crop), `CATS`, `TAGS`.

Clicking a screen dispatches an `enigma:select` CustomEvent — the connection point
for anything you want to build on top of it.

### 03 · The floating portfolio

Screens ride a wide shallow ellipse. Everything visible is derived from one
parameter `t`:

```
X   = A sin t                    world x
Z   = -D + B cos t               world z   (0 = the camera plane)
s   = P / (P - Z)                perspective scale
yaw = atan2(B sin t, A cos t)    the ellipse tangent's normal
```

`A 1900 · B 665 · D 1100 · P 1412`. The fitted **shape** — `B/A = 0.35` — is what
sets the rake, and it is preserved exactly; only the room's scale was grown, so the
screens got much larger at the same rake. Arc pitch is 19° against a 559-wide
hero, which leaves a 71-unit gap between neighbours.

Size, screen position, yaw and brightness are all consequences of a panel's 3D
coordinate. Nothing is authored per panel, and nothing is faked with a
`translateX`.

Config: `PROJECTS` — eight slots, each with a fixed world size measured from the
reference, an `accent` (`red` / `dark` / `none`) and an `op` for framing. Slot 08 is
the one text card among the photographs.

Controls here work differently from 05/06: the arrows and drag write a `manual`
offset, and the conveyor target is rebuilt as `scrollBase() + manual` on every
frame. `STEP_JUMP` is 42 — two screens at the 19° pitch, one per marker. See rule 1.

### 04 · Model in focus

Four moods orbit the portrait on a ring tilted 14°, radius 231. The scroll turns
the ring; everything else is a consequence. Inside each transition, four
thresholds fire in order:

```
f 0.06   the outgoing panel retracts
f 0.58   the incoming node seats at the top station (halo)
f 0.66   its information panel floats in            (CSS, 500ms)
f 0.84   its mood enters the medallion from the LEFT (CSS, 750ms)
```

Crossing a threshold arms a **class**; CSS then carries the micro-animation to its
end in either direction. That is deliberate: fast scrolling never truncates a
beat, and scrolling back replays everything mirrored.

Config: `MOODS` — name, focus, approach, availability, `grade`, `op`.

### 05 · One look, four moods

Four prints in one 3D studio, positioned by a continuous `s = index - progress`:

```
s -1   spent    retired LEFT, sunk back, raked away, darkening
s  0   active   centre, facing the camera, red editorial frame
s +1   next     waiting RIGHT, raked away, left edge nearest
s +2+  queue    deeper and darker along the same rake
```

Positions interpolate between measured waypoints
`[x, y, z, rotY, rotZ, veil, opacity]`, which is why both prints stay visible
through a hand-off: one photograph is carried away as the next is carried in,
rather than crossfading.

Drag is supported, at `2.0` px of page scroll per px of horizontal drag.

Config: `PRINTS` — look, mood, title, body, `grade`, `op`.

### 06 · Behind the scenes

The four-frame row is the resting truth. Each frame has two poses — its measured
**row slot** (`SLOT_X = [-332.5, -107.5, 117, 336]`, deeper and dimmer and turned
away in proportion to its distance from the active frame) and its **active pose**,
pulled forward off the row toward the camera.

A frame blends between the two by its continuous distance from the scroll
progress. So a hand-off is one frame physically settling back — left, into depth,
darkening, turning away — while the next comes forward from its own slot. No
crossfades; both travel.

Config: `FRAMES` — caption and `op`. The red destination panel beside the row takes
`story/paris.jpg`, red-graded automatically; with no file the panel keeps its glow
and nothing breaks.

### 07 · The final scene

A closing shot, not a footer. One scroll-driven timeline writes a handful of CSS
custom properties, and CSS does the rest:

```
atmo  0.08 → 0.35
mark  0.20 → 0.60
copy  0.45 → 0.62
nav   0.60 → 0.78    (per-link stagger inside the window)
soc   0.78 → 0.92
base  0.88 → 1.00
```

The wordmark rises through the same red-ink filter as section 01, over the same
atmosphere plate. Scrolling up rewinds the scene — and because every section is a
pure function of scroll, the *Back to top* link rewinds the entire film on the way.

Links marked `data-magnet` lean toward an approaching cursor: up to **8px**, from
**110px** away, computed in the same rAF loop that glides the timeline.

---

## The assets

### Shipped to the browser

| file | used by | note |
|---|---|---|
| `BACKGROUNF IMG.jpg` | 01, 07 | the atmosphere plate |
| `GIRL IMAGE.jpg` | 01 | the portrait — and the universal fallback for every empty slot |
| `TITTLE.jpg` | 01, 07 | the ENIGMA wordmark, flat red on black, recoloured by the SVG filter |
| `fonts/archivo-var.woff2` | all | Archivo variable — weight 100–900, width 62–125%, SIL OFL 1.1 |
| `archive/01–11.jpg` | 02 | the archive room |
| `projects/01–07.jpg` | 03 | slot 08 is a text card, so there is no `08.jpg` |
| `looks/01–04.jpg` | 04 | one per mood |
| `behind/01–04.jpg` | 05 | one per print |
| `story/01–04.jpg`, `story/paris.jpg` | 06 | four frames plus the destination panel |

One font file covers the whole site. Archivo carries a **width axis**, and `81%`
width reproduces Archivo Narrow exactly — measured at 1750.2px against 1747.0px on
the header string. That is why the header is one family and two axes rather than
two font files, and why every size and tracking value from the reference carried
over unchanged.

### Reference images — the measuring source, never served

These are not used by the site. They are the images every number in the CSS was
read off, and they are kept in the repo so the measurements can be re-derived or
challenged.

| file | measured for |
|---|---|
| `ACTUAL REFRENCE.jpg` | section 01 composition, 1536 × 1024 |
| `ALL THE TEXTS.jpg` | section 01 copy and its placement |
| `REFRENCE IMAGE FOR SECTION 2.jpg` | section 02, the archive room |
| `Section 3 refrence.jpeg` | section 03, the ellipse fit |
| `Section 4 refrence.jpg` | section 04, the tilted ring |
| `Section 5 refrence.jpg` | section 05, the print waypoints |
| `section 6 refrence.jpg` | section 06, the four-frame row |

### Provenance of the photographs

Eleven photographs were supplied as `image to add *.jpg` and distributed into the
section folders. They are still in the repo at the root as the originals. The
current mapping:

| source | lands in |
|---|---|
| `image to add one.jpg` | `archive/09`, `looks/03`, `story/01` |
| `image to add 2.jpg` | `archive/06`, `projects/06` |
| `image to add 3.jpg` | `archive/08`, `projects/04`, `story/02` |
| `image to add 4.jpg` | `archive/11`, `looks/01`, `story/paris` |
| `image to add 5.jpg` | `archive/05`, `projects/05`, `story/04` |
| `image to add 6.jpg` | `archive/04`, `looks/04`, `story/03` |
| `image to add 7.jpg` | `archive/10`, `behind/03`, `looks/02`, `projects/07` |
| `image to add 8.jpg` | `archive/07`, `behind/04` |
| `image to add 9.jpg` | `archive/01`, `behind/01`, `projects/01` |
| `image to add 10.jpg` | `archive/03`, `projects/03` |
| `image to add 11.jpg` | `archive/02`, `behind/02`, `projects/02` |

The reuse across sections is the honest state of the build: eleven photographs
filling thirty-one slots. Sections 03–06 want their own imagery, and the moment you
drop real files in, the reuse disappears with no code change.

---

## Replacing the placeholders

Every section folder carries its own `README.txt` with the exact filenames it
wants. The short version:

| drop into | named | count |
|---|---|---|
| `archive/` | `01.jpg` … `11.jpg` | up to 24; raise `count` in `SETS` to go further |
| `projects/` | `01.jpg` … `07.jpg` | 7 photographs; slot 08 is the text card |
| `looks/` | `01.jpg` … `04.jpg` | 4, one per mood |
| `behind/` | `01.jpg` … `04.jpg` | 4, one per print |
| `story/` | `01.jpg` … `04.jpg` + `paris.jpg` | 4 frames + destination |

Three things worth knowing before you do:

**The geometry does not move.** Each slot's world size, and therefore its aspect
ratio, crop and on-screen dimensions, is fixed in the config. Adding a photograph
changes the content, not the composition.

**The grades are placeholders and they remove themselves.** The red, noir, crimson,
eclipse and signature washes exist so that a fallback portrait repeated four times
still reads as four distinct moods. Each one is dropped the moment a real
photograph loads, so your imagery is never tinted.

**Tune the framing with `op`, not with the geometry.** Every config entry has an `op`
field that is passed straight to CSS `object-position`. If a face is being cropped,
change `op`. Do not change `w`/`h`.

Copy lives in the same configs — `MOODS`, `PRINTS`, `FRAMES`, `PROJECTS`, `CATS`,
`TAGS` — and in `index.html` for the static rails. Nothing is duplicated between
the two.

---

## The prompts

Written to be pasted at an agent one at a time, in order; each assumes the previous
one landed. Where a prompt says *measure*, the reference image genuinely has to be
opened and read — accepting an eyeballed number there is how the whole thing turns
into a template.

The single most important instruction, and it belongs at the top of the very first
message of the session:

> Build this as a film, not as a page. Every section is a camera in a room, and the
> scroll is the only motor that moves it. At every decision ask: does this read as
> something photographed, or as a website? No gradients-as-decoration, no
> glassmorphism, no rounded cards, no bounce or elastic easing, no animation
> without a reason. Nothing generates artwork — every image on screen is one I
> supplied. And every number you write must come from measuring my reference image,
> not from taste.

Keep it visible. Re-paste it whenever the work drifts; it is the only prompt here
worth repeating.

---

### Phase 0 · The ground rules

> Static site. No framework, no build step, no npm, no dependencies. One
> `index.html`, and one CSS file plus one JS file per section, named for the
> section. Each JS file is an IIFE in strict mode that returns early if its section
> is not in the DOM, so any section can be deleted by removing its two tags.
>
> Self-host the typeface — no Google Fonts link, no network dependency at first
> paint, so the entrance is identical offline. I want one variable grotesque with a
> **width axis** (Archivo: weight 100–900, width 62–125%) as a single `.woff2`.
>
> Three rules that hold for the whole build, and you should refuse to break them:
>
> 1. Every section past the hero is a **pure function of scroll position**. No
>    section keeps animation state that the scroll cannot reproduce. Drag, arrow
>    buttons and clicks must move the page scroll, never drive a second animation
>    system.
> 2. All geometry is expressed in **reference pixels** — declare `--u` as one pixel
>    of the reference frame using `clamp(min, min(Xvw, Yvh), max)` and multiply
>    everything by it. `min(vw, vh)` so the composition scales to the tighter axis
>    and the vertical rhythm never breaks.
> 3. Motion is `transform` and `opacity` only. Every rAF loop glides toward a target
>    and **shuts itself off** once settled — idle must be genuinely still.

The width axis is not optional. `81%` width reproduces Archivo Narrow exactly, which
is what lets the header be one font file instead of two.

---

### Phase 1 · Section 01, the entrance

> Here is `ACTUAL REFRENCE.jpg` (1536 × 1024) and `ALL THE TEXTS.jpg`. Reverse-measure
> the composition: gutters, type sizes, tracking, the exact position of every text
> block. Write them as multiples of `--u`.
>
> Three supplied assets and nothing else: `BACKGROUNF IMG.jpg` is the atmosphere,
> `GIRL IMAGE.jpg` is the portrait, `TITTLE.jpg` is the ENIGMA wordmark.
>
> `TITTLE.jpg` is flat red on pure black, and I need it to composite over the
> photograph with **no black box and no halo**. Do not cut it out and do not
> regenerate it as text. Build an SVG `feColorMatrix` that maps the source red
> channel to alpha and paints the reference ink — sample the ink off the reference
> rather than picking it.
>
> Then direct the entrance as a timed sequence, roughly 3.9s from first paint:
> black, atmosphere, the portrait emerging and settling, the wordmark rising,
> supporting copy, the red accent, header, the small editorial information
> staggered, then the section nav. Stack the portrait twice — soft under sharp — so
> it *develops* rather than fades in.
>
> No easing may overshoot. An elastic curve reads as UI; this has to read as film.
>
> Drive `data-state` on `<html>`: `preload` → `intro` → `live`. Pointer parallax
> engages only at `live`, so a moving cursor cannot disturb the entrance.

---

### Phase 2 · Section 02, the archive room

> Here is `REFRENCE IMAGE FOR SECTION 2.jpg` (1200 × 753). Build the room behind it.
>
> It must be a rectangular **volume**, not a ring: screens at arbitrary angle,
> radius and height inside a room turning about a vertical axis set some distance
> in front of the camera. Let radius vary about 5:1 across the set, so a panel's
> nearest pass renders around 1.44× and its farthest around 0.29×. **Depth, not
> rotation, is what has to read as depth** — if every screen sits at one radius you
> have built a carousel and it is wrong.
>
> No two screens may share an orbit, or the cylinder resolves and the illusion dies.
> Give the outermost panels — the ones that sweep closest to the camera — a large
> `y` so they pass above or below the central corridor instead of blocking the view
> into the room.
>
> Each panel counter-rotates the room's spin so it broadly faces the camera. Drive
> both the spin and every counter-rotation from **one inherited `--spin` custom
> property**, so the whole room costs one variable write per frame.
>
> Draw no walls. The boundary is pure tonal separation — a deep centre a few values
> above black, falling to black at the edges.
>
> Warning you will otherwise lose an afternoon to: `opacity` and `filter` collapse
> `preserve-3d` to flat. Nothing between the room and an individual panel may be
> faded — fold depth, reveal and exit into each panel's own opacity variable.
>
> Wire drag and scroll into the same spin, and make clicking a screen dispatch an
> `enigma:select` CustomEvent. Also give this file the page's one global smooth-scroll
> handler for every `[data-scroll]` link.

---

### Phase 3 · Section 03, the floating portfolio

> Here is `Section 3 refrence.jpeg` (1536 × 1024). Reverse-fit the ellipse the screens
> ride on — do not eyeball it. Derive `A`, `B`, `D` and the perspective `P` from the
> reference, and tell me the fitted `B/A`.
>
> Then derive **everything** from one parameter `t`:
> `X = A sin t`, `Z = -D + B cos t`, scale `= P / (P - Z)`, and yaw from the ellipse
> tangent's normal. Size, screen position, rotation and brightness are all
> consequences of a panel's 3D coordinate. Nothing may be authored per panel and
> nothing may be faked with `translateX`.
>
> The screens in my reference are larger than a literal fit gives. Grow the room's
> scale but **keep `B/A` exactly** — the ratio is what sets the rake, and changing it
> changes the shot.
>
> Fix each slot's world size in the config, measured from the reference, and check
> the arc pitch clears the widest panel. Report the gap in world units so I can see
> it. One of the eight is a text card, not a photograph.

The build as it stands answered the "arrows and drag" half of this differently from
sections 05 and 06 — it keeps a persistent `manual` offset instead of moving the
page scroll. If you want the strict form, say so in this prompt explicitly, and
require `scrollToState()` the way Phase 5 does.

---

### Phase 4 · Section 04, model in focus

> Here is `Section 4 refrence.jpg` (1536 × 1024). Four moods orbit a central portrait
> medallion on a tilted ring; the scroll turns the ring and everything else is a
> consequence. Measure the ring radius, the tilt, the left rail and the information
> panel box.
>
> Inside each transition, four beats fire in order: the outgoing panel retracts
> early, the incoming node seats at the top station with its halo, its information
> panel floats in, and its mood enters the medallion **from the left**.
>
> Implement the beats by having the scroll **arm a class** at each threshold and
> letting CSS carry the animation to its end. Do not tween them from JS. The reason
> is concrete: fast scrolling must never truncate a beat, and scrolling back must
> replay everything mirrored — a JS tween gives you neither.
>
> Until I supply four photographs, every slot falls back to the hero portrait with
> its own grade — noir, crimson, eclipse, signature. That is the section's concept,
> not a stopgap. Drop the grade the instant a real photograph loads.

---

### Phase 5 · Section 05, one look four moods

> Here is `Section 5 refrence.jpg` (1536 × 839). Four prints in one 3D studio.
>
> Position them on a continuous `s = index - progress`: `s = 0` is centre and facing
> the camera in a red editorial frame, `s = +1` waits to the right raked away with
> its left edge nearest, `s = -1` is spent and retired to the left sunk back and
> darkening, and anything beyond goes deeper and darker along the same rake.
>
> Measure a waypoint per integer `s` — `[x, y, z, rotY, rotZ, veil, opacity]` — and
> **interpolate between them**. This is the whole point of the section: both prints
> stay visible through a hand-off, so one photograph is physically carried away as
> the next is carried in. If you find yourself writing a crossfade, you have
> misread it.
>
> Add horizontal drag and previous/next buttons. Both must move the page's scroll —
> they may not drive the prints directly.

---

### Phase 6 · Section 06, behind the scenes

> Here is `section 6 refrence.jpg` (1536 × 1024). A four-frame editorial row plus the
> red destination panel on the right. Measure the four frame centres in the row and
> the panel's box.
>
> The row is the resting truth. Give every frame two poses: its **row slot** — deeper,
> dimmer, rotated away in proportion to its distance from the active frame — and an
> **active pose** pulled forward off the row toward the camera. Blend between them by
> the frame's continuous distance from the scroll progress.
>
> So a hand-off is one frame settling back — left, into depth, darkening, turning
> away — while the next comes forward out of its own slot. Both travel. No
> crossfades, and scrolling up must replay it backwards exactly.
>
> The destination panel takes `story/paris.jpg` and red-grades it automatically. With
> no file, the panel keeps its glow and nothing breaks — no broken image, no gap.

---

### Phase 7 · Section 07, the final scene

> Build the closing shot. This is not a footer.
>
> One scroll-driven timeline writes a handful of CSS custom properties and CSS does
> the rest: the atmosphere plate arrives, the ENIGMA mark rises through the same
> red-ink filter as section 01, the closing line lands, then the nav with a per-link
> stagger, then socials, then the baseline.
>
> Because every section of this site is a pure function of scroll, the *Back to top*
> link rewinds the entire film on the way — check that it actually does.
>
> Give the important links a magnetic lean: a few pixels toward an approaching
> cursor and a settle back, computed in the **same** rAF loop that glides the
> timeline, and shutting off with it. No second loop.

---

### Phase 8 · The passes

> Four passes over everything, in this order:
>
> 1. **Responsive.** Recompute `--u` at the breakpoints rather than writing new
>    layouts. Check a short window as carefully as a narrow one — this composition
>    fails on height before it fails on width.
> 2. **Reduced motion.** Every section honours `prefers-reduced-motion: reduce` in
>    both its CSS and its JS. Reduced motion means the final state is reachable and
>    correct, not that the section is broken or blank.
> 3. **Accessibility.** Decorative imagery is `aria-hidden` with an empty `alt`; the
>    portrait carries a real description; every nav has a label; the wordmark image
>    carries `alt="ENIGMA"`.
> 4. **Idle.** Load the page, scroll to the bottom of each section, stop, and confirm
>    every rAF loop has shut itself off. Any loop still running at rest is a bug.

---

## The verification loop

Screenshots against the reference, not opinions. `.probe/` holds the harness that
was used to take them, and `.shots/` holds the results.

| file | what it does |
|---|---|
| `.probe/sec.html` | loads `index.html` in a 1536 × 1024 iframe and parks it at `?sec=<id>&t=<0..1>` — an exact point in one section's runway |
| `.probe/slow.html` | same, but waits for every image in the target section to load before positioning |
| `.probe/dec.html` | same, but awaits `img.decode()` on all of them, then fires a second `scroll` — for sections that settle late |
| `.probe/imgcheck.html` | counts, per section, how many images actually resolved and how many fell back |
| `.probe/why.html` | dumps computed styles for one element — the debugger of last resort |

`.shots/` keeps the record:

```
01-hero.png  02-archive.png  03-folio.png  04-looks.png  05-behind.png
07-finale.png  07-reveal.png

03-vs-reference.png  04-vs-reference.png  05-vs-reference.png
06-vs-reference.png

portfolio-hero.png  portfolio-details.png  portfolio-restructure.png
```

The `NN-vs-reference.png` composites place a section beside the image it was
measured from, and they are the actual acceptance test — a section is done when its
composite holds up, not when it looks good on its own. Section 06 has only its
composite, and section 02 only its plain shot; both are gaps in the record rather
than statements about the sections.

The loop, in practice:

1. Serve the folder.
2. Open `.probe/sec.html?sec=folio&t=0.45`.
3. Screenshot it, put it beside `Section 3 refrence.jpeg`.
4. Fix the number that is wrong. Not the appearance — the number.
5. Repeat.

---

## Responsive, reduced motion, accessibility

**Responsive.** Three breakpoints, and they recompute `--u` rather than rewriting
layout:

```
@media (max-width: 1024px)
@media (max-width: 640px), (max-aspect-ratio: 3/4)
@media (max-aspect-ratio: 3/4), (max-width: 700px)
```

The aspect-ratio clauses are load-bearing. This composition fails on *height*
before it fails on width, and a width-only breakpoint set will not catch it.

**Reduced motion.** All fourteen CSS and JS files honour
`prefers-reduced-motion: reduce`. The auto-spin in section 02 stops, the entrance
resolves to its final state, and every scroll-driven section still reaches every
state — the scroll still positions everything, it just does not glide there.

**Accessibility.** Decorative imagery is `aria-hidden` with empty `alt`; the hero
portrait carries a real description; the wordmark image carries `alt="ENIGMA"`;
every `<nav>` has an `aria-label`; the section list is an ordered list with
`aria-current`; controls are real `<button>` elements with labels.

---

## File map

```
index.html                      all seven sections, one file
ENIGMA.md                       this guide
README.md                       the front door

hero.css   hero.js              01 · the entrance
space.css  space.js             02 · the archive room + the page's smooth scroll
folio.css  folio.js             03 · the floating portfolio
looks.css  looks.js             04 · model in focus
behind.css behind.js            05 · one look, four moods
story.css  story.js             06 · behind the scenes
fin.css    fin.js               07 · the final scene

fonts/archivo-var.woff2         Archivo variable — weight + width axes

BACKGROUNF IMG.jpg              the atmosphere plate          (01, 07)
GIRL IMAGE.jpg                  the portrait, and the fallback (01, all)
TITTLE.jpg                      the ENIGMA wordmark            (01, 07)

archive/   01–11.jpg  + README.txt
projects/  01–07.jpg  + README.txt
looks/     01–04.jpg  + README.txt
behind/    01–04.jpg  + README.txt
story/     01–04.jpg, paris.jpg + README.txt

ACTUAL REFRENCE.jpg             reference — 01
ALL THE TEXTS.jpg               reference — 01 copy
REFRENCE IMAGE FOR SECTION 2.jpg  reference — 02
Section 3 refrence.jpeg         reference — 03
Section 4 refrence.jpg          reference — 04
Section 5 refrence.jpg          reference — 05
section 6 refrence.jpg          reference — 06
image to add *.jpg              the eleven supplied photographs, as delivered

.probe/                         the screenshot harness
.shots/                         section screenshots and reference composites
.claude/launch.json             the dev-server definition
```

---

## What is still placeholder

Honest list, so nothing here gets mistaken for finished:

- **Copy.** Only section 04's first mood and section 06's first caption are verbatim
  from the references. Everything else is placeholder written to the same schema —
  correct in shape, not in content.
- **The measurements card.** Section 06's `<dl>` — height, bust, waist, hips, shoe,
  hair, eyes, languages — is a grid of em-dashes waiting for the real card.
- **Social links.** Every `href` in section 06 and 07 is `#`.
- **Section imagery.** Eleven photographs fill thirty-one slots, so images repeat
  across sections. Dropping real files into `projects/`, `looks/`, `behind/` and
  `story/` removes the repetition with no code change.
- **The grades.** The red, noir, crimson, eclipse and signature washes are stand-in
  treatment. They remove themselves as real photographs load.
- **Section 03's control model.** Its arrows and drag write a persistent `manual`
  offset rather than moving the page scroll, so unlike 05 and 06 its position is not
  recoverable from the scrollbar alone. It works; it is simply the one section that
  does not hold rule 1 in its strict form.

---

*ENIGMA — Fashion Model. Paris · Milan · London · Worldwide.*
