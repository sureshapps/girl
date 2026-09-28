/* ============================================================================
   ENIGMA — SECTION 05 · BEHIND THE SCENES
   ---------------------------------------------------------------------------
   Four prints in one 3D studio. Continuous position s = index - progress:

     s -1   spent   -> retired LEFT, sunk back, raked away, darkening
     s  0   active  -> centre, facing the camera, red editorial frame
     s +1   next    -> waiting RIGHT, raked away, left edge nearest
     s +2+  queue   -> deeper and darker along the same rake

   Positions interpolate between measured waypoints, so both prints stay
   visible through a hand-off — one photograph is carried away as the next
   is carried in. Everything is a pure function of scroll: reversing the
   scroll replays the studio backwards. Idle is genuinely still (the rAF
   loop glides progress and parallax, then shuts itself off).

   Click a waiting print, the ← → controls, or drag: all of them just move
   the page's scroll — one source of truth, no second animation system.
   ========================================================================== */
(function () {
  'use strict';

  /* =========================================================================
     1 · THE PRINTS  —  the only part you normally need to touch
     Drop behind/01.jpg … 04.jpg in and they replace the placeholders.
     Panel 01's copy is verbatim from the reference; 02-04 are placeholders
     in the same schema.
     ====================================================================== */
  var IMAGE_DIR = 'behind/';
  var FALLBACK  = 'GIRL%20IMAGE.jpg';

  var PRINTS = [
    { look:'One Look', mood:'Mood 01',  title:'Editorial',
      body:'Bold colour, dramatic movement and a strong editorial silhouette.',
      grade:'crimson', op:'50% 28%' },
    { look:'One Look', mood:'Mood 02',  title:'Minimal',
      body:'Clean lines, controlled expression and understated elegance.',
      grade:'noir', op:'52% 18%' },
    { look:'One Look', mood:'Mood 03',  title:'Beauty',
      body:'Intimate framing, natural expression and refined detail.',
      grade:'eclipse', op:'44% 42%' },
    { look:'One Look', mood:'Mood 04',  title:'Campaign',
      body:'Effortless energy designed for modern commercial storytelling.',
      grade:'signature', op:'40% 46%' }
  ];

  /* =========================================================================
     2 · WAYPOINTS  —  measured against the reference
     [x, y, z, rotY, rotZ, veil, opacity]  ·  design units / degrees
     ====================================================================== */
  var WAY = {
    '-2': [-1290, 16, -560, -24, -1.2, .84, 0   ],
    '-1': [ -820, 10, -300, -20,  -.8, .60, .92 ],
     '0': [    0,  0,    0, -1.5,   0, 0,   1   ],
     '1': [  918, 10, -260,  27,   .6, .52, 1   ],
     '2': [ 1530, 22, -560,  33,  1.0, .72, .92 ],
     '3': [ 2010, 30, -840,  37,  1.2, .82, .78 ]
  };

  var STATES  = PRINTS.length;
  var GLIDE   = 0.13;         /* progress glide toward the scroll target    */
  var DRAG_K  = 2.0;          /* px of page scroll per px of horizontal drag */

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp  = function (v,a,b){ return v<a?a:v>b?b:v; };

  var section = document.getElementById('behind');
  if (!section) return;
  var stage = section.querySelector('.behind__rig');
  var prog  = section.querySelector('.behind__prog');

  /* =========================================================================
     3 · BUILD
     ====================================================================== */
  function h(tag, cls, parent) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (parent) parent.appendChild(el);
    return el;
  }

  var panels = [];
  PRINTS.forEach(function (m, i) {
    var p = h('article', 'bsp', stage);
    p.dataset.grade = m.grade;
    p.dataset.placeholder = '';
    p.dataset.index = String(i);
    if (m.op) p.style.setProperty('--op', m.op);

    h('i', 'bsp__slab', p);
    var frame = h('div', 'bsp__frame', p);

    var img = h('img', null, frame);
    img.alt = m.title; img.decoding = 'async'; img.draggable = false;
    img.src = IMAGE_DIR + '0' + (i + 1) + '.jpg';
    img.addEventListener('load', function () {
      delete p.dataset.placeholder;               /* your image, untinted */
    });
    img.addEventListener('error', function () {
      if (this.dataset.fell) { this.remove(); return; }
      this.dataset.fell = '1';
      this.src = FALLBACK;
    });
    h('i', 'bsp__wash', frame);
    var veil = h('i', 'bsp__veil', frame);

    var meta = h('div', 'bsp__meta', frame);
    var lk = h('div', 'bsp__look', meta);
    lk.appendChild(document.createTextNode(m.look + ' '));
    h('i', null, lk);
    lk.appendChild(document.createTextNode(' ' + m.mood));
    h('div', 'bsp__name', meta).textContent = m.title;
    h('p', 'bsp__body', meta).textContent = m.body;

    var edge = h('button', 'bsp__edge', p);
    edge.type = 'button';
    edge.setAttribute('aria-label', 'Next print');
    edge.textContent = '↔';
    edge.addEventListener('click', function (e) {
      e.stopPropagation();
      step(1);
    });

    panels.push({ el: p, veil: veil, active: false, live: false,
                  lastKey: '', lastO: -1, lastV: -1 });
  });

  var progEls = prog ? prog.querySelectorAll('b') : [];

  /* =========================================================================
     4 · STATE  —  the scroll position is the single source of truth
     ====================================================================== */
  var p = 0, pT = 0;                       /* progress 0..3                 */
  var px = 0, py = 0, tx = 0, ty = 0;      /* parallax                      */
  var BU = 1, lit = false, visible = false, running = false, raf = 0;
  var activeIdx = -1;

  function readUnit() {
    BU = parseFloat(getComputedStyle(section).getPropertyValue('--bu')) || 1;
  }
  function runLen() { return (section.offsetHeight - (innerHeight || 1)) || 1; }
  function scrollP() {
    var r = section.getBoundingClientRect();
    return clamp(-r.top / runLen(), 0, 1) * (STATES - 1);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function paint() {
    for (var i = 0; i < panels.length; i++) {
      var s = i - p;
      var k = Math.floor(s), f = s - k;
      var A = WAY[String(clamp(k, -2, 3))]   || WAY['3'];
      var B = WAY[String(clamp(k + 1, -2, 3))] || WAY['3'];
      var x  = lerp(A[0], B[0], f), y  = lerp(A[1], B[1], f);
      var z  = lerp(A[2], B[2], f), ry = lerp(A[3], B[3], f);
      var rz = lerp(A[4], B[4], f), v  = lerp(A[5], B[5], f);
      var o  = lerp(A[6], B[6], f);

      var pn = panels[i];
      var key = (x * BU).toFixed(1) + '|' + (z * BU).toFixed(1) + '|' + ry.toFixed(2);
      if (key !== pn.lastKey) {
        pn.el.style.transform =
          'translate3d(' + (x * BU).toFixed(1) + 'px,' + (y * BU).toFixed(1) + 'px,'
                         + (z * BU).toFixed(1) + 'px)'
          + ' rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg)';
        pn.lastKey = key;
      }
      var qo = Math.round(o * 100) / 100, qv = Math.round(v * 100) / 100;
      if (qo !== pn.lastO) { pn.el.style.setProperty('--o', qo); pn.lastO = qo; }
      if (qv !== pn.lastV) { pn.veil.style.setProperty('--v', qv); pn.lastV = qv; }

      var live = Math.abs(s) < 1.5;
      if (live !== pn.live) { pn.el.classList.toggle('is-live', live); pn.live = live; }
    }

    var act = clamp(Math.round(p), 0, STATES - 1);
    if (act !== activeIdx) {
      activeIdx = act;
      for (var j = 0; j < panels.length; j++) {
        var on = j === act;
        if (on !== panels[j].active) {
          panels[j].el.classList.toggle('is-active', on);
          panels[j].active = on;
        }
        if (progEls[j]) progEls[j].classList.toggle('is-on', on);
      }
    }
    section.style.setProperty('--p', p.toFixed(4));
  }

  /* =========================================================================
     5 · LOOP  —  glide, then stop dead
     ====================================================================== */
  function frame() {
    if (!running) return;
    p += (pT - p) * (reduce ? 1 : GLIDE);
    if (Math.abs(pT - p) < 0.0006) p = pT;
    px += (tx - px) * 0.07;
    py += (ty - py) * 0.07;
    section.style.setProperty('--px', (px * 1.1).toFixed(2) + '%');
    section.style.setProperty('--py', (py * 0.8).toFixed(2) + '%');
    section.style.setProperty('--ox', (px * 1.3).toFixed(2) + 'deg');
    section.style.setProperty('--oy', (py * 0.9).toFixed(2) + 'deg');
    paint();
    var busy = Math.abs(pT - p) > 0.0006
            || Math.abs(tx - px) > 0.002 || Math.abs(ty - py) > 0.002;
    if (!busy) { running = false; return; }
    raf = requestAnimationFrame(frame);
  }
  function start(){ if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  /* =========================================================================
     6 · SCROLL · CLICK · DRAG · POINTER  —  all of them move the scroll
     ====================================================================== */
  function onScroll() {
    pT = scrollP();
    var r = section.getBoundingClientRect(), vh = innerHeight || 1;
    var shown = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    visible = shown > 0;
    if (!lit && shown / vh > 0.3) { lit = true; section.classList.add('is-lit'); }
    if (visible) start(); else stop();
  }
  addEventListener('scroll', onScroll, { passive: true });
  if (window.IntersectionObserver) {
    new IntersectionObserver(onScroll, { threshold: [0, .25, .5, .75, 1] })
      .observe(section);
  }

  /* smooth scroll to a print's state — cancelled by any real user input */
  var animId = 0;
  function scrollToState(k) {
    var from = scrollY;
    var to = section.offsetTop + runLen() * clamp(k, 0, STATES - 1) / (STATES - 1);
    if (reduce) { scrollTo(0, to); return; }
    var t0 = performance.now(), dur = 620, my = ++animId;
    (function tick(now) {
      if (my !== animId) return;
      var t = clamp((now - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - t, 3);
      scrollTo(0, from + (to - from) * e);
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }
  function cancelAuto(){ animId++; }
  addEventListener('wheel', cancelAuto, { passive: true });
  addEventListener('touchmove', cancelAuto, { passive: true });

  function step(d) { scrollToState(clamp(Math.round(p) + d, 0, STATES - 1)); }

  var ctl = section.querySelectorAll('.behind__ctl button');
  if (ctl[0]) ctl[0].addEventListener('click', function(){ step(-1); });
  if (ctl[2]) ctl[2].addEventListener('click', function(){ step(1); });

  /* click a print: bring it forward — by scrolling to it */
  section.addEventListener('click', function (e) {
    if (wasDrag) { wasDrag = false; return; }
    var el = e.target.closest('.bsp.is-live');
    if (!el || e.target.closest('.bsp__edge')) return;
    var i = Number(el.dataset.index || 0);
    if (i !== Math.round(p)) scrollToState(i);
    section.dispatchEvent(new CustomEvent('enigma:print', {
      bubbles: true, detail: { index: i }
    }));
  });

  /* horizontal drag = scroll, exactly as the hand icon promises */
  var dragging = false, dragId = null, dx0 = 0, moved = 0, wasDrag = false;
  section.addEventListener('pointerdown', function (e) {
    if (e.button || e.target.closest('button')) return;
    dragging = true; dragId = e.pointerId; dx0 = e.clientX; moved = 0; wasDrag = false;
    section.classList.add('is-dragging');
    cancelAuto();
    try { section.setPointerCapture(dragId); } catch (err) {}
  });
  section.addEventListener('pointermove', function (e) {
    if (dragging && e.pointerId === dragId) {
      var d = e.clientX - dx0; dx0 = e.clientX; moved += Math.abs(d);
      scrollBy(0, -d * DRAG_K);
      return;
    }
    if (e.pointerType === 'mouse') {
      var r = section.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width  - 0.5) * -2;
      ty = ((e.clientY - r.top)  / r.height - 0.5) * -2;
      if (visible) start();
    }
  }, { passive: true });
  function endDrag(e) {
    if (!dragging || (e && e.pointerId !== dragId)) return;
    dragging = false; wasDrag = moved > 6; dragId = null;
    section.classList.remove('is-dragging');
    try { section.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  section.addEventListener('pointerup', endDrag);
  section.addEventListener('pointercancel', endDrag);
  section.addEventListener('pointerleave', function () {
    tx = ty = 0;
    if (visible) start();
  }, { passive: true });

  section.addEventListener('pointerover', function (e) {
    if (e.target.closest('.bsp.is-live')) section.classList.add('is-hovering');
  });
  section.addEventListener('pointerout', function (e) {
    if (!e.relatedTarget || !e.relatedTarget.closest('.bsp.is-live'))
      section.classList.remove('is-hovering');
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (visible) start();
  });

  var rt;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      readUnit();
      for (var i = 0; i < panels.length; i++) panels[i].lastKey = '';
      onScroll(); paint();
    }, 200);
  });

  /* =========================================================================
     7 · GO  —  assembled at print 01, still until the visitor scrolls
     ====================================================================== */
  readUnit();
  onScroll();
  p = pT;                     /* no opening lurch if the page loads mid-scroll */
  paint();

})();
