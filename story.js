/* ============================================================================
   ENIGMA — SECTION 06 · BEHIND THE SCENES (THE STORY)
   ---------------------------------------------------------------------------
   The four-frame row from the reference is the resting truth. Each frame has
   two poses:

     ROW POSE      its measured slot in the row — deeper, dimmer, rotated
                   away in proportion to its distance from the active frame
     ACTIVE POSE   pulled forward off the row toward the camera, facing it

   A frame's state blends between the two by its continuous distance from
   the scroll progress, so a hand-off is one frame physically settling back
   — left and into depth, darkening, turning away — while the next comes
   forward from its own slot. No crossfades; both travel. Scroll up replays
   it backwards exactly. Idle is genuinely still.
   ========================================================================== */
(function () {
  'use strict';

  /* =========================================================================
     1 · THE FRAMES  —  the only part you normally need to touch
     Drop story/01.jpg … 04.jpg (and story/paris.jpg for the red panel) in
     and they replace the placeholders. Frame 01's caption is verbatim from
     the reference.
     ====================================================================== */
  var IMAGE_DIR = 'story/';
  var FALLBACK  = 'GIRL%20IMAGE.jpg';

  var FRAMES = [
    { caption:'Preparation — the details begin here.',              op:'80% 32%' },
    { caption:'On set — photographers, stylists, direction.',       op:'63% 35%' },
    { caption:'Movement — every pose becomes part of the story.',   op:'55% 32%' },
    { caption:'The final frame — the work behind the image.',       op:'36% 24%' }
  ];

  /* =========================================================================
     2 · GEOMETRY  —  slots measured from the reference row
     ====================================================================== */
  var SLOT_X = [-332.5, -107.5, 117, 336];   /* frame centres, design units */
  var STATES = FRAMES.length;
  var GLIDE  = 0.13;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp  = function (v,a,b){ return v<a?a:v>b?b:v; };
  var smooth = function (t){ t=clamp(t,0,1); return t*t*(3-2*t); };

  var section = document.getElementById('story');
  if (!section) return;
  var rig    = section.querySelector('.story__rig');
  var cap    = section.querySelector('.story__cap');
  var capNum = section.querySelector('.story__capnum');
  var capTxt = section.querySelector('.story__captxt');

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
  FRAMES.forEach(function (m, i) {
    var p = h('article', 'sfp', rig);
    p.dataset.index = String(i);
    p.dataset.placeholder = '';
    if (m.op) p.style.setProperty('--op', m.op);

    h('i', 'sfp__slab', p);
    var frame = h('div', 'sfp__frame', p);
    var img = h('img', null, frame);
    img.alt = m.caption; img.decoding = 'async'; img.draggable = false;
    img.src = IMAGE_DIR + '0' + (i + 1) + '.jpg';
    img.addEventListener('load', function () { delete p.dataset.placeholder; });
    img.addEventListener('error', function () {
      if (this.dataset.fell) { this.remove(); return; }
      this.dataset.fell = '1';
      this.src = FALLBACK;
    });
    h('i', 'sfp__wash', frame);
    var veil = h('i', 'sfp__veil', frame);
    h('span', 'sfp__tag', frame).textContent = '0' + (i + 1);

    panels.push({ el: p, veil: veil, active: false, live: false,
                  lastKey: '', lastO: -1, lastV: -1 });
  });

  /* =========================================================================
     4 · POSES
     ====================================================================== */
  function pose(i, P) {
    var d  = i - P;                       /* signed distance from the front */
    var ad = Math.min(Math.abs(d), 2.5);
    var t  = smooth(Math.abs(d));         /* 0 = active pose · 1 = row pose */

    /* row pose: the measured slot, receding with distance */
    var rx = SLOT_X[i];
    var rz = -40 - 40 * ad;
    var ry = (d > 0 ? 1 : -1) * (9 + 5 * ad);
    var rv = 0.30 + 0.13 * ad;
    var ro = 1 - 0.06 * ad;

    /* active pose: forward off the row, facing the camera. It keeps its
       slot x — the reference row must read at every resting state.       */
    var ax = SLOT_X[i];
    var az = 30;
    var ay2 = -1.5;
    var av = 0;

    return {
      x:  ax + (rx - ax) * t,
      y:  0,
      z:  az + (rz - az) * t,
      ry: ay2 + (ry - ay2) * t,
      v:  av + (rv - av) * t,
      o:  1 + (ro - 1) * t
    };
  }

  /* =========================================================================
     5 · STATE
     ====================================================================== */
  var p = 0, pT = 0;
  var px = 0, py = 0, tx = 0, ty = 0;
  var SU = 1, lit = false, visible = false, running = false, raf = 0;
  var activeIdx = -1;

  function readUnit() {
    SU = parseFloat(getComputedStyle(section).getPropertyValue('--su')) || 1;
  }
  function runLen() { return (section.offsetHeight - (innerHeight || 1)) || 1; }
  function scrollP() {
    var r = section.getBoundingClientRect();
    return clamp(-r.top / runLen(), 0, 1) * (STATES - 1);
  }

  function paint() {
    for (var i = 0; i < panels.length; i++) {
      var q = pose(i, p);
      var pn = panels[i];
      var key = (q.x * SU).toFixed(1) + '|' + (q.z * SU).toFixed(1) + '|' + q.ry.toFixed(2);
      if (key !== pn.lastKey) {
        pn.el.style.transform =
          'translate3d(' + (q.x * SU).toFixed(1) + 'px,' + (q.y * SU).toFixed(1) + 'px,'
                         + (q.z * SU).toFixed(1) + 'px) rotateY(' + q.ry.toFixed(2) + 'deg)';
        pn.lastKey = key;
      }
      var qo = Math.round(q.o * 100) / 100, qv = Math.round(q.v * 100) / 100;
      if (qo !== pn.lastO) { pn.el.style.setProperty('--o', qo); pn.lastO = qo; }
      if (qv !== pn.lastV) { pn.veil.style.setProperty('--v', qv); pn.lastV = qv; }

      var live = true;                    /* every frame is clickable */
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
      }
      /* caption swap: quick dip, new line, back up */
      if (cap) {
        cap.classList.add('is-swapping');
        (function (k) {
          setTimeout(function () {
            if (activeIdx !== k) return;
            capNum.textContent = '0' + (k + 1);
            capTxt.textContent = FRAMES[k].caption;
            cap.classList.remove('is-swapping');
          }, reduce ? 0 : 240);
        })(act);
      }
    }
    section.style.setProperty('--p', p.toFixed(4));
  }

  /* =========================================================================
     6 · LOOP  —  glide, then stop dead
     ====================================================================== */
  function frame(){
    if (!running) return;
    p += (pT - p) * (reduce ? 1 : GLIDE);
    if (Math.abs(pT - p) < 0.0006) p = pT;
    px += (tx - px) * 0.07;
    py += (ty - py) * 0.07;
    section.style.setProperty('--px', (px * 1.0).toFixed(2) + '%');
    section.style.setProperty('--py', (py * 0.7).toFixed(2) + '%');
    section.style.setProperty('--ox', (px * 1.2).toFixed(2) + 'deg');
    section.style.setProperty('--oy', (py * 0.8).toFixed(2) + 'deg');
    var pi = section.querySelector('.story__pimg');
    if (pi) pi.style.setProperty('--tx', (px * -6).toFixed(1));
    paint();
    var busy = Math.abs(pT - p) > 0.0006
            || Math.abs(tx - px) > 0.002 || Math.abs(ty - py) > 0.002;
    if (!busy) { running = false; return; }
    raf = requestAnimationFrame(frame);
  }
  function start(){ if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  /* =========================================================================
     7 · INPUT  —  scroll is the source of truth; clicks move the scroll
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

  var animId = 0;
  function scrollToState(k) {
    var from = scrollY;
    var to = section.offsetTop + runLen() * clamp(k, 0, STATES - 1) / (STATES - 1);
    if (reduce) { scrollTo(0, to); return; }
    var t0 = performance.now(), dur = 620, my = ++animId;
    (function tick(now) {
      if (my !== animId) return;
      var t = clamp((now - t0) / dur, 0, 1);
      scrollTo(0, from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }
  addEventListener('wheel', function(){ animId++; }, { passive: true });
  addEventListener('touchmove', function(){ animId++; }, { passive: true });

  section.addEventListener('click', function (e) {
    var el = e.target.closest('.sfp');
    if (el) {
      var i = Number(el.dataset.index || 0);
      if (i !== Math.round(p)) scrollToState(i);
      section.dispatchEvent(new CustomEvent('enigma:scene', {
        bubbles: true, detail: { index: i }
      }));
      return;
    }
    if (e.target.closest('.story__go')) scrollToState(Math.round(p) + 1);
  });

  section.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var r = section.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width  - 0.5) * -2;
    ty = ((e.clientY - r.top)  / r.height - 0.5) * -2;
    if (visible) start();
  }, { passive: true });
  section.addEventListener('pointerleave', function () {
    tx = ty = 0;
    if (visible) start();
  }, { passive: true });

  section.addEventListener('pointerover', function (e) {
    if (e.target.closest('.sfp')) section.classList.add('is-hovering');
  });
  section.addEventListener('pointerout', function (e) {
    if (!e.relatedTarget || !e.relatedTarget.closest('.sfp'))
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
     8 · GO  —  frame 01 forward, still until the visitor scrolls
     ====================================================================== */
  readUnit();
  onScroll();
  p = pT;
  activeIdx = -1;               /* force the first caption fill */
  paint();

})();
