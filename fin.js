/* ============================================================================
   ENIGMA — SECTION 07 · THE FINAL SCENE
   ---------------------------------------------------------------------------
   The closing shot. One scroll-driven timeline writes a handful of CSS
   custom properties; CSS does the rest. Scrolling up rewinds the scene, and
   because every section of this site is a pure function of scroll, the
   final call's return-to-top rewinds the entire film on the way.

   Magnetics: the important links lean a few pixels toward an approaching
   cursor and settle back — computed in the same rAF loop that glides the
   timeline, which shuts itself off the moment everything is still.
   ========================================================================== */
(function () {
  'use strict';

  /* the beats of the closing timeline (progress in, progress out) */
  var BEATS = {
    atmo: [0.08, 0.35],
    mark: [0.20, 0.60],
    copy: [0.45, 0.62],
    nav:  [0.60, 0.78],   /* per-link stagger inside this window */
    soc:  [0.78, 0.92],
    base: [0.88, 1.00]
  };
  var GLIDE   = 0.14;
  var MAG_R   = 110;      /* px — how close the cursor must come            */
  var MAG_MAX = 8;        /* px — the most a link will lean                 */

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp  = function (v,a,b){ return v<a?a:v>b?b:v; };
  var smooth = function (a,b,x){ var t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };

  var section = document.getElementById('finale');
  if (!section) return;
  var navBox   = section.querySelector('.fin__nav');
  var navLinks = [].slice.call(section.querySelectorAll('.fin__nav a'));
  var magnets  = [].slice.call(section.querySelectorAll('[data-magnet]'))
    .map(function (el) { return { el: el, x: 0, y: 0, tx: 0, ty: 0 }; });

  /* =========================================================================
     TIMELINE
     ====================================================================== */
  var p = 0, pT = 0;
  var mx = -1e5, my = -1e5;             /* pointer, viewport space          */
  var px = 0, py = 0, tx = 0, ty = 0;   /* parallax                         */
  var visible = false, running = false, raf = 0;
  var lastVars = '';

  function scrollP() {
    var r = section.getBoundingClientRect();
    var run = (section.offsetHeight - (innerHeight || 1)) || 1;
    return clamp(-r.top / run, 0, 1);
  }

  function apply() {
    var s = section.style;
    var vars =
      (smooth(BEATS.atmo[0], BEATS.atmo[1], p)).toFixed(3) + '|' +
      (smooth(BEATS.mark[0], BEATS.mark[1], p)).toFixed(3) + '|' +
      (smooth(BEATS.copy[0], BEATS.copy[1], p)).toFixed(3) + '|' +
      (smooth(BEATS.soc[0],  BEATS.soc[1],  p)).toFixed(3) + '|' +
      (smooth(BEATS.base[0], BEATS.base[1], p)).toFixed(3);
    if (vars !== lastVars) {
      lastVars = vars;
      var v = vars.split('|');
      s.setProperty('--e-atmo', v[0]);
      s.setProperty('--e-mark', v[1]);
      s.setProperty('--e-copy', v[2]);
      s.setProperty('--e-soc',  v[3]);
      s.setProperty('--e-base', v[4]);
    }
    /* navigation: one link at a time inside its window */
    var w0 = BEATS.nav[0], span = (BEATS.nav[1] - BEATS.nav[0]);
    for (var i = 0; i < navLinks.length; i++) {
      var a = w0 + (span * 0.5) * (i / Math.max(1, navLinks.length - 1));
      var lk = smooth(a, a + span * 0.5, p).toFixed(3);
      if (navLinks[i].dataset.lk !== lk) {
        navLinks[i].dataset.lk = lk;
        navLinks[i].style.setProperty('--lk', lk);
      }
    }
  }

  /* =========================================================================
     LOOP — timeline glide + parallax + magnetics, then stop dead
     ====================================================================== */
  function frame() {
    if (!running) return;
    var busy = false;

    pT = scrollP();               /* re-read: scroll events can be throttled */
    p += (pT - p) * (reduce ? 1 : GLIDE);
    if (Math.abs(pT - p) < 0.0006) p = pT; else busy = true;
    apply();

    px += (tx - px) * 0.07;
    py += (ty - py) * 0.07;
    if (Math.abs(tx - px) > 0.002 || Math.abs(ty - py) > 0.002) busy = true;
    var s = section.style;
    s.setProperty('--pxa', (px * 2).toFixed(2));
    s.setProperty('--pya', (py * 1.4).toFixed(2));
    s.setProperty('--pxm', (px * 5).toFixed(2));
    s.setProperty('--pym', (py * 3).toFixed(2));
    s.setProperty('--pxf', (px * 7).toFixed(2));
    s.setProperty('--pyf', (py * 5).toFixed(2));

    /* magnetics: lean toward a near cursor, settle back otherwise */
    for (var i = 0; i < magnets.length; i++) {
      var m = magnets[i];
      var r = m.el.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = mx - cx, dy = my - cy;
      var d = Math.hypot(dx, dy);
      var k = reduce ? 0 : Math.max(0, 1 - d / MAG_R);
      m.tx = dx * k * (MAG_MAX / MAG_R) * 2.2;
      m.ty = dy * k * (MAG_MAX / MAG_R) * 2.2;
      m.tx = clamp(m.tx, -MAG_MAX, MAG_MAX);
      m.ty = clamp(m.ty, -MAG_MAX, MAG_MAX);
      m.x += (m.tx - m.x) * 0.16;
      m.y += (m.ty - m.y) * 0.16;
      if (Math.abs(m.tx - m.x) > 0.05 || Math.abs(m.x) > 0.05 ||
          Math.abs(m.ty - m.y) > 0.05 || Math.abs(m.y) > 0.05) busy = true;
      m.el.style.setProperty('--mgx', m.x.toFixed(2));
      m.el.style.setProperty('--mgy', m.y.toFixed(2));
    }

    if (!busy) { running = false; return; }
    raf = requestAnimationFrame(frame);
  }
  function start(){ if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  /* =========================================================================
     INPUT
     ====================================================================== */
  function onScroll() {
    pT = scrollP();
    var r = section.getBoundingClientRect(), vh = innerHeight || 1;
    visible = Math.min(r.bottom, vh) - Math.max(r.top, 0) > 0;
    if (visible) start(); else stop();
  }
  addEventListener('scroll', onScroll, { passive: true });
  if (window.IntersectionObserver) {
    new IntersectionObserver(onScroll, { threshold: [0, .25, .5, .75, 1] })
      .observe(section);
  }

  section.addEventListener('pointermove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (e.pointerType === 'mouse') {
      var r = section.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width  - 0.5) * -2;
      ty = ((e.clientY - r.top)  / r.height - 0.5) * -2;
    }
    if (visible) start();
  }, { passive: true });
  section.addEventListener('pointerleave', function () {
    mx = my = -1e5; tx = ty = 0;
    if (visible) start();
  }, { passive: true });

  if (navBox) {
    navBox.addEventListener('pointerover', function (e) {
      if (e.target.closest('a')) navBox.classList.add('is-hovering');
    });
    navBox.addEventListener('pointerout', function (e) {
      if (!e.relatedTarget || !e.relatedTarget.closest('a'))
        navBox.classList.remove('is-hovering');
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (visible) start();
  });

  /* =========================================================================
     THE RETURN — closing the magazine rewinds the whole film
     ====================================================================== */
  var animId = 0;
  function rewind(to, dur) {
    if (reduce) { scrollTo(0, to); return; }
    var from = scrollY, t0 = performance.now(), my2 = ++animId;
    (function tick(now) {
      if (my2 !== animId) return;
      var t = clamp((now - t0) / dur, 0, 1);
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      scrollTo(0, from + (to - from) * e);
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }
  addEventListener('wheel', function(){ animId++; }, { passive: true });
  addEventListener('touchmove', function(){ animId++; }, { passive: true });

  function goTo(sel, dur) {
    var el = document.querySelector(sel);
    if (el) rewind(el.offsetTop, dur || 900);
  }

  /* the enquiry: opens mail when an address is configured on data-enquiry;
     until then it presents the professional details instead              */
  var call = section.querySelector('.fin__call');
  if (call) call.addEventListener('click', function (e) {
    var addr = call.getAttribute('data-enquiry');
    if (addr) { call.href = 'mailto:' + addr; return; }
    e.preventDefault();
    goTo('#story', 1400);
  });
  var top = section.querySelector('.fin__top');
  if (top) top.addEventListener('click', function (e) {
    e.preventDefault();
    rewind(0, 2400);                    /* the long ride back through it all */
  });
  navLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = a.getAttribute('data-to');
      if (!t) return;
      e.preventDefault();
      goTo(t, 1200);
    });
  });

  /* =========================================================================
     GO
     ====================================================================== */
  onScroll();
  p = pT;
  apply();

})();
