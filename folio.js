/* ============================================================================
   ENIGMA — SECTION 03 · THE FLOATING PORTFOLIO
   ---------------------------------------------------------------------------
   Screens ride a wide shallow ellipse reverse-fitted from the reference.
   The fitted SHAPE (B/A = 0.35) is kept exactly; only the room's scale grew,
   so A 1900 x B 665 carries much larger screens at the same rake. Every panel's size, screen position, yaw and
   brightness is DERIVED from its 3D coordinate — nothing is authored per
   panel and nothing is faked with translateX.

     t          angle around the ellipse (the conveyor parameter)
     X = A sin t                     world x
     Z = -D + B cos t                world z  (0 = camera plane)
     s = P / (P - Z)                 perspective scale
     yaw = atan2(B sin t, A cos t)   the ellipse tangent's normal

   Scroll position — and nothing else — sets t, so a screen enters from the
   left background, swells as it crosses the near arc, then rakes away and
   sinks to the right. Scrolling back up retraces it exactly.
   ========================================================================== */
(function () {
  'use strict';

  /* =========================================================================
     1 · THE WORK  —  the only part you normally need to touch
     Drop 01.jpg … 08.jpg into /projects and they appear. Nothing else moves:
     each slot's world size is fixed here, so the geometry is identical
     before and after you add the real photographs.
     ====================================================================== */
  var IMAGE_DIR = 'projects/';
  var IMAGE_EXT = '.jpg';
  /* No stand-in photograph: eight copies of one portrait reads far worse
     than a clean card, and the brief asks for clean placeholders. A slot
     with no file simply shows its card until you drop the real work in.  */

  var PROJECTS = [
    /* A curated selection across the four working categories. World sizes
       unchanged — only the content is the model's.                        */
    { n:'01', title:'Editorial',   w:559, h:793, accent:'red',
      cta:'View', op:'50% 18%' },
    { n:'02', title:'Beauty',      w:472, h:737, accent:'none', op:'55% 25%' },
    { n:'03', title:'Campaign',    w:398, h:737, accent:'red',  op:'50% 28%' },
    { n:'04', title:'Runway',      w:429, h:737, accent:'none', op:'63% 38%' },
    { n:'05', title:'Editorial',   w:390, h:702, accent:'none', op:'38% 22%' },
    { n:'06', title:'Beauty',      w:458, h:737, accent:'none', op:'46% 28%' },
    { n:'07', title:'Campaign',    w:413, h:709, accent:'red',  op:'42% 40%' },
    /* the one text card among the photographs */
    { n:'08', title:'Selected Work', w:484, h:737, accent:'dark', type:'note',
      body:'A curated selection of editorial, beauty, campaign and runway work.', cta:'' }
  ];

  /* =========================================================================
     2 · GEOMETRY  —  fitted to "Section 3 refrence.jpeg"
     ====================================================================== */
  var P = 1412;          /* perspective, in design units                    */

  var FRONT = {
    /* the fitted SHAPE is preserved exactly — B/A stays 0.35, which is what
       sets the rake. Only the room's scale grows, so the screens can be much
       larger without becoming a collage: at the pitch below the hero still
       clears its neighbours by 73 world units.                            */
    A: 1900, B: 665, D: 1100,
    y: 138,                     /* screens sit just below the horizon       */
    xOff: 0,
    step: 19,                   /* arc pitch 630 vs a 559-wide hero: 71 gap */
    count: 8,                   /* == PROJECTS.length: no work twice on screen */
    fadeIn: 40, fadeOut: 62     /* zero well before the seam (8 * 19 / 2 = 76) */
  };

  /* the deeper tier of small screens above and behind. Its members are
     deliberately uneven in size — in the reference they are different crops,
     not merely further away.                                              */
  var BACK = {
    A: 3000, B: 1050, D: 2300,
    y: -600,                    /* interlocks with the front row, as the reference does */
    xOff: 440,                  /* its apex sits right of the front row's   */
    step: 12, count: 14,
    fadeIn: 42, fadeOut: 60
  };
  var BACK_SIZE = [
    [244,293],[230,261],[242,322],[269,310],[293,335],[310,328],
    [279,312],[256,299],[234,266],[222,246],[246,293],[261,310]
  ];

  /* =========================================================================
     3 · MOTION  —  the scroll is the only motor
     There is no drift, no orbit, no timer and no momentum. `travel` is a
     direct function of scroll position, so scrolling back up retraces the
     journey exactly. The loop shuts itself off the moment nothing is
     changing, which is what makes idle genuinely still rather than merely
     slow.
     ====================================================================== */
  var SPAN      = 304;     /* degrees travelled across the whole section
                              (two full cycles of eight screens)           */
  var DRAG_K    = 0.10;    /* degrees per pixel dragged                     */
  var STEP_JUMP = 42;      /* two screens, for the two markers              */
  var GLIDE     = 0.13;    /* how quickly travel catches its target         */
  var PARALLAX  = 13;      /* px of camera response to the pointer          */

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp  = function (v,a,b){ return v<a?a:v>b?b:v; };
  var ease   = function (t){ return t<=0?0:t>=1?1:1-Math.pow(1-t,3); };
  var smooth = function (e0,e1,x){ var t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };

  var section = document.getElementById('folio');
  if (!section) return;
  var scene = section.querySelector('.folio__scene');
  var stage = section.querySelector('.folio__stage');
  var wall  = section.querySelector('.folio__wall');
  var floor = section.querySelector('.folio__floor');
  var ui    = section.querySelector('.folio__ui');

  /* =========================================================================
     4 · BUILD
     ====================================================================== */
  var panels = [];

  function makePanel(tier, cfg, i, spec, size) {
    var el = document.createElement('article');
    el.className = 'fp';
    el.dataset.tier = tier;

    var w = size ? size[0] : spec.w;
    var h = size ? size[1] : spec.h;
    el.style.setProperty('--w', w);
    el.style.setProperty('--h', h);
    el.style.setProperty('--th', tier === 'front' ? 4 : 2);
    if (spec) {
      el.dataset.accent = spec.accent || 'none';
      if (spec.op) el.style.setProperty('--op', spec.op);
    }

    var cast = document.createElement('i'); cast.className = 'fp__cast';
    var slab = document.createElement('i'); slab.className = 'fp__slab';
    var face = document.createElement('div'); face.className = 'fp__face';

    var img = document.createElement('img');
    img.alt = ''; img.decoding = 'async'; img.draggable = false;
    var n = (i % PROJECTS.length) + 1;
    img.src = IMAGE_DIR + (n < 10 ? '0' : '') + n + IMAGE_EXT;
    el.dataset.placeholder = '';                     /* until a real one lands */
    img.addEventListener('load', function () {
      delete el.dataset.placeholder;                 /* your image, untinted   */
    });
    img.addEventListener('error', function () {
      this.remove();            /* never leave a broken-image glyph */
    });
    face.appendChild(img);

    var wash = document.createElement('i'); wash.className = 'fp__wash';
    face.appendChild(wash);
    var veil = document.createElement('i'); veil.className = 'fp__veil';
    face.appendChild(veil);

    if (tier === 'front' && spec) {
      var type = document.createElement('div'); type.className = 'fp__type';
      var num = document.createElement('div'); num.className = 'fp__num';
      num.textContent = spec.n;
      var ttl = document.createElement('div'); ttl.className = 'fp__title';
      ttl.textContent = spec.title;
      type.appendChild(num); type.appendChild(ttl);
      if (spec.body) {
        var bd = document.createElement('p'); bd.className = 'fp__body';
        bd.textContent = spec.body; type.appendChild(bd);
      }
      face.appendChild(type);

      if (spec.cta !== '') {
        var cta = document.createElement('div'); cta.className = 'fp__cta';
        var lbl = document.createElement('span');
        lbl.textContent = spec.cta || 'View';
        var mk = document.createElement('span'); mk.className = 'fp__mark';
        mk.textContent = spec.type === 'note' ? '→' : '↗';
        cta.appendChild(lbl); cta.appendChild(mk);
        face.appendChild(cta);
      }
      el.dataset.index = String(i % PROJECTS.length);
    }

    el.appendChild(cast); el.appendChild(slab); el.appendChild(face);
    stage.appendChild(el);

    return { el: el, veil: veil, face: face, tier: tier, cfg: cfg,
             base: i * cfg.step, w: w, h: h,
             lastT: 1e9, lastO: -1, lastV: -1, live: false };
  }

  function build() {
    stage.textContent = '';
    panels.length = 0;
    var i;
    for (i = 0; i < BACK.count; i++)
      panels.push(makePanel('back', BACK, i, null, BACK_SIZE[i % BACK_SIZE.length]));
    for (i = 0; i < FRONT.count; i++)
      panels.push(makePanel('front', FRONT, i, PROJECTS[i % PROJECTS.length]));
  }

  /* =========================================================================
     5 · PLACE  —  everything below is derived from t
     ====================================================================== */
  var FU = 1;                       /* px per design unit, read from CSS    */
  function readUnit() {
    var v = parseFloat(getComputedStyle(section).getPropertyValue('--fu'));
    FU = v || 1;
  }

  var travel = 0, target = 0, manual = 0;      /* target = scroll + manual  */
  var revealT = -1, camX = 0, camY = 0, tgtX = 0, tgtY = 0;
  var exitMul = 1;

  function place() {
    for (var i = 0; i < panels.length; i++) {
      var p = panels[i], c = p.cfg;
      var win = c.count * c.step;

      /* wrap into a window that is an exact multiple of the pitch, so the
         spacing is preserved across the seam and the seam itself is dark  */
      var t = (p.base + travel + win * 0.5) % win;
      if (t < 0) t += win;
      t -= win * 0.5;

      var r  = t * Math.PI / 180;
      var st = Math.sin(r), ct = Math.cos(r);
      var Z  = -c.D + c.B * ct;
      var s  = P / (P - Z);
      var X  = (c.A * st + c.xOff) * 1;
      var yaw = Math.atan2(c.B * st, c.A * ct) * 180 / Math.PI;

      /* screens ride the arc, so a little of the tilt comes with it */
      var tilt = -st * 1.6;

      var vis = 1 - smooth(c.fadeIn, c.fadeOut, Math.abs(t));
      if (vis <= 0.001) {
        if (p.lastO !== 0) { p.el.style.setProperty('--o', 0); p.lastO = 0; }
        if (p.live) { p.el.classList.remove('is-live'); p.live = false; }
        continue;
      }

      /* depth -> light. Near screens read fully; far ones sink into the room */
      var near = P / (P - (-c.D + c.B));
      var far  = P / (P - (-c.D - c.B));
      var d    = clamp((s - far) / (near - far), 0, 1);
      /* a raked screen catches less of the implied light, so brightness
         follows facing as well as depth — this is what sinks the wings   */
      var face = Math.cos(yaw * Math.PI / 180);
      /* the near arc is the lit part of the room: brightness falls with both
         facing and angular distance from it                                */
      var lit  = 1 - 0.42 * smooth(4, 58, Math.abs(t));
      var o    = (0.40 + 0.60 * Math.pow(d, 0.85)) * (0.52 + 0.48 * face) * lit
                 * vis * revealFor(p, d) * exitMul;
      var v    = (c === BACK ? 0.26 : 0) + 0.42 * Math.pow(1 - d, 1.1)
                 + 0.30 * (1 - face) + 0.22 * (1 - lit);

      if (Math.abs(t - p.lastT) > 0.004) {
        p.el.style.setProperty('--tx', (X * FU).toFixed(1) + 'px');
        p.el.style.setProperty('--ty', (c.y * FU).toFixed(1) + 'px');
        p.el.style.setProperty('--tz', (Z * FU).toFixed(1) + 'px');
        p.el.style.setProperty('--yaw', yaw.toFixed(2) + 'deg');
        p.el.style.setProperty('--tilt', tilt.toFixed(2) + 'deg');
        p.lastT = t;
      }
      var qo = Math.round(o * 100) / 100, qv = Math.round(Math.min(v, 0.93) * 100) / 100;
      if (qo !== p.lastO) { p.el.style.setProperty('--o', qo); p.lastO = qo; }
      if (qv !== p.lastV) { p.veil.style.setProperty('--v', qv); p.lastV = qv; }

      var live = p.tier === 'front' && d > 0.55 && vis > 0.7;
      if (live !== p.live) { p.el.classList.toggle('is-live', live); p.live = live; }
    }
  }

  /* entry: foreground first, then midground, then the deep tier */
  function revealFor(p, d) {
    if (revealT < 0) return 0;
    if (revealT >= 2) return 1;
    var delay = (p.tier === 'front' ? 0.10 : 0.42) + (1 - d) * 0.34;
    return ease((revealT - delay) / 0.52);
  }

  /* =========================================================================
     6 · LOOP
     ====================================================================== */
  var running = false, raf = 0, last = 0, visible = false;

  function frame(now) {
    if (!running) return;
    /* never trust the clock to move forward: a backwards timestamp would
       drive the reveal negative and strand the section unlit */
    var dt = clamp((now - last) / 1000, 0, 0.05) || 0.016;
    last = now;

    if (revealT >= 0 && revealT < 2) {
      revealT += dt;
      var e = ease(revealT / 0.46) * exitMul;
      scene.style.opacity = e.toFixed(3);
      if (wall)  wall.style.opacity  = (e * 0.95).toFixed(3);
      if (floor) floor.style.opacity = (e * 0.9).toFixed(3);
      if (ui)    ui.style.opacity    = ease((revealT - 0.85) / 0.5).toFixed(3);
    }

    /* glide toward whatever the scroll (plus any drag) asks for. Nothing
       adds to `target` except the user.                                   */
    travel += (target - travel) * GLIDE;
    if (Math.abs(target - travel) < 0.002) travel = target;

    camX += (tgtX - camX) * 0.06;
    camY += (tgtY - camY) * 0.06;
    section.style.setProperty('--cam-x', (37.2 - camX * 2.1).toFixed(2) + '%');
    section.style.setProperty('--cam-y', (50 - camY * 1.5).toFixed(2) + '%');
    if (wall) {
      section.style.setProperty('--wall-x', (camX * PARALLAX).toFixed(1) + 'px');
      section.style.setProperty('--wall-y', (camY * PARALLAX * 0.6).toFixed(1) + 'px');
    }

    place();

    /* stop dead when there is nothing left to move */
    var busy = (revealT >= 0 && revealT < 2)
            || Math.abs(target - travel) > 0.002
            || Math.abs(tgtX - camX) > 0.0009
            || Math.abs(tgtY - camY) > 0.0009
            || dragging;
    if (!busy) { running = false; return; }
    raf = requestAnimationFrame(frame);
  }
  function start(){ if(!running){ running=true; last=performance.now(); raf=requestAnimationFrame(frame);} }
  function stop(){ running=false; cancelAnimationFrame(raf); }

  function wake() {
    if (revealT >= 0) return;
    if (reduce) {
      revealT = 2;
      scene.style.opacity = 1;
      if (wall) wall.style.opacity = .95;
      if (floor) floor.style.opacity = .9;
      if (ui) ui.style.opacity = 1;
    } else revealT = 0;
    start();
  }

  /* =========================================================================
     7 · INTERACTION
     ====================================================================== */
  /* every input writes `manual`; `target` is rebuilt from scroll + manual,
     so the mapping stays exactly reversible                               */
  function retarget(){ target = scrollBase() + manual; start(); }
  function push(d){ manual += d; retarget(); }

  section.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || dragging) return;
    var r = section.getBoundingClientRect();
    tgtX = ((e.clientX - r.left) / r.width  - 0.5) * -2;
    tgtY = ((e.clientY - r.top)  / r.height - 0.5) * -2;
    start();
  }, { passive: true });
  section.addEventListener('pointerleave', function(){ tgtX = tgtY = 0; start(); }, { passive:true });

  section.addEventListener('pointerover', function (e) {
    if (e.target.closest('.fp.is-live')) section.classList.add('is-hovering');
  });
  section.addEventListener('pointerout', function (e) {
    if (!e.relatedTarget || !e.relatedTarget.closest('.fp.is-live'))
      section.classList.remove('is-hovering');
  });

  var dragging = false, dragId = null, dx0 = 0, moved = 0, wasDrag = false;
  section.addEventListener('pointerdown', function (e) {
    if (e.button || e.target.closest('.folio__step')) return;
    dragging = true; dragId = e.pointerId;
    dx0 = e.clientX; moved = 0; wasDrag = false;
    try { section.setPointerCapture(dragId); } catch (err) {}
    start();
  });
  section.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== dragId) return;
    var d = e.clientX - dx0;
    dx0 = e.clientX; moved += Math.abs(d);
    manual -= d * DRAG_K;          /* the hand pushes it, nothing carries on */
    retarget();
  });
  function endDrag(e) {
    if (!dragging || (e && e.pointerId !== dragId)) return;
    dragging = false;
    try { section.releasePointerCapture(dragId); } catch (err) {}
    wasDrag = moved > 6; dragId = null;   /* released means stopped */
  }
  section.addEventListener('pointerup', endDrag);
  section.addEventListener('pointercancel', endDrag);

  section.addEventListener('click', function (e) {
    if (wasDrag) { wasDrag = false; return; }
    var p = e.target.closest('.fp.is-live');
    if (!p) return;
    section.dispatchEvent(new CustomEvent('enigma:project', {
      bubbles: true, detail: { index: Number(p.dataset.index || 0), from: 3 }
    }));
  });

  var stepEls = section.querySelectorAll('.folio__step button');
  if (stepEls[0]) stepEls[0].addEventListener('click', function(){ push(STEP_JUMP); });
  if (stepEls[1]) stepEls[1].addEventListener('click', function(){ push(-STEP_JUMP); });

  /* =========================================================================
     8 · SCROLL  —  travels the installation, and carries it away on exit
     ====================================================================== */
  /* how far through the section we have scrolled, 0 -> 1 */
  function progress() {
    var r = section.getBoundingClientRect(), h = innerHeight || 1;
    var run = (section.offsetHeight - h) || 1;
    return clamp(-r.top / run, 0, 1);
  }
  function scrollBase(){ return progress() * SPAN; }

  function onScroll() {
    /* travel is a pure function of scroll position, so scrolling back up
       retraces the journey exactly                                        */
    target = scrollBase() + manual;

    var r = section.getBoundingClientRect(), h = innerHeight || 1;
    var shown = Math.min(r.bottom, h) - Math.max(r.top, 0);
    var ratio = shown / h;
    visible = shown > 0;
    if (ratio > 0.3) wake();
    if (visible) { if (revealT >= 0) start(); } else stop();

    /* leaving: the camera keeps going, the screens sink away rather than
       simply fading                                                       */
    var t = r.bottom < h ? clamp(1 - r.bottom / h, 0, 1) : 0;   /* leaving */
    exitMul = 1 - t * 0.95;
    if (revealT >= 2) {
      scene.style.opacity = exitMul.toFixed(3);
      if (wall)  wall.style.opacity  = (exitMul * 0.95).toFixed(3);
      if (floor) floor.style.opacity = (exitMul * 0.9).toFixed(3);
    }
  }
  addEventListener('scroll', onScroll, { passive: true });

  if (window.IntersectionObserver) {
    new IntersectionObserver(onScroll, { threshold:[0,.25,.5,.75,1] }).observe(section);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (revealT >= 0 && visible) start();
  });

  var rt;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      readUnit();
      for (var i = 0; i < panels.length; i++) panels[i].lastT = 1e9;
      place(); onScroll();
    }, 200);
  });

  /* =========================================================================
     9 · GO
     ====================================================================== */
  build();
  readUnit();
  onScroll();
  travel = target;        /* no opening lurch if the page loads mid-scroll */
  place();

})();
