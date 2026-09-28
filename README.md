# ENIGMA — Fashion Model

A seven-section, scroll-driven portfolio site. No framework, no build step, no
dependencies: one `index.html`, one CSS file and one JS file per section, and a
folder of photographs.

**→ [`ENIGMA.md`](ENIGMA.md) is the guide.** What is built, the flow the scroll
drives, the rules every section obeys, every asset and where it came from, the
prompts that produced it, and the verification loop.

---

## Run it

```bash
python -m http.server 5173
```

Open `http://localhost:5173`. Any static server works; `file://` does not — the
self-hosted font and the fallback-image probing both need real HTTP.

---

## The seven sections

| # | id | what it is |
|---|---|---|
| 01 | `#hero` | the cinematic entrance — a timed sequence, ~3.9s from first paint |
| 02 | `#archive` | the archive room — a volume of screens turning about an axis |
| 03 | `#folio` | the floating portfolio — screens riding a wide shallow ellipse |
| 04 | `#looks` | model in focus — four moods orbiting a portrait on a tilted ring |
| 05 | `#behind` | one look, four moods — prints handed through a 3D studio |
| 06 | `#story` | behind the scenes — a four-frame row, one frame pulled forward |
| 07 | `#finale` | the final scene — the closing shot, not a footer |

Scroll is the motor. Everything past the hero is derived from scroll position, so
the page plays forward and rewinds.

## Adding your photographs

Drop numbered files into the section folders — each carries a `README.txt` with
the exact names it wants:

```
archive/   01.jpg … 11.jpg
projects/  01.jpg … 07.jpg      (slot 08 is a text card)
looks/     01.jpg … 04.jpg
behind/    01.jpg … 04.jpg
story/     01.jpg … 04.jpg  +  paris.jpg
```

The geometry does not move when you do — every slot's world size was measured and
fixed in the config. The placeholder colour grades drop themselves the moment a
real photograph loads, so your imagery is never tinted. Tune framing with the `op`
field (`object-position`) in each config, never with `w`/`h`.

Full detail, and the list of what is still placeholder, in
[`ENIGMA.md`](ENIGMA.md).
