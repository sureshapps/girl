/* ============================================================================
   ENIGMA — HERO  ·  cinematic entrance sequence
   ---------------------------------------------------------------------------
   Directs the supplied assets only. Nothing here generates artwork.
   All motion is transform/opacity (compositor-only) so the reveal holds 60fps.
   ========================================================================== */
(function () {
  'use strict';

  var root  = document.documentElement;
  var hero  = document.getElementById('hero');
  if (!hero) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------------------------
     Timeline (ms from the first painted frame). Frame numbers refer to the
     brief. Durations sit inside the ranges it specifies.
     ---------------------------------------------------------------------- */
  var T = {
    black   : 300,   // FRAME 00 — pure darkness
    bg      : 300,   // FRAME 01 — colour atmosphere
    girl    : 900,   // FRAME 02/03 — the portrait emerges, then settles
    title   : 1700,  // FRAME 04 — ENIGMA rises
    copy    : 2680,  // FRAME 05 — supporting editorial text
    date    : 2900,  // FRAME 06 — date / red accent
    hdrSide : 3000,  // FRAME 07 — header
    hdrMid  : 3050,
    bts     : 3540,  // FRAME 08 — small editorial information (staggered)
    edn     : 3610,
    rail    : 3680,
    footL   : 3730,
    footC   : 3790,
    footR   : 3850,
    secnav  : 3900   // FRAME 09 — section navigation
  };

  var E = {
    atmos : 'cubic-bezier(.33,0,.15,1)',
    photo : 'cubic-bezier(.16,1,.3,1)',
    lift  : 'cubic-bezier(.19,1,.22,1)',
    fine  : 'cubic-bezier(.22,.61,.36,1)',
    settle: 'cubic-bezier(.4,0,.2,1)'
  };

  var q  = function (s) { return hero.querySelector(s); };
  var qa = function (s) { return Array.prototype.slice.call(hero.querySelectorAll(s)); };
  var el = function (n)  { return hero.querySelector('[data-in="' + n + '"]'); };

  var animations = [];
  function play(node, frames, opts) {
    if (!node) return null;
    var a = node.animate(frames, Object.assign({ fill: 'both' }, opts));
    animations.push(a);
    return a;
  }

  /* ---- helpers: standard "arrives from below" editorial reveal ----------- */
  function rise(node, delay, dist, dur, ease) {
    return play(node, [
      { opacity: 0, transform: 'translate3d(0,' + dist + 'px,0)' },
      { opacity: 1, transform: 'translate3d(0,0,0)' }
    ], { delay: delay, duration: dur || 460, easing: ease || E.fine });
  }
  function drop(node, delay, dist, dur) {
    return play(node, [
      { opacity: 0, transform: 'translate3d(0,' + (-dist) + 'px,0)' },
      { opacity: 1, transform: 'translate3d(0,0,0)' }
    ], { delay: delay, duration: dur || 600, easing: E.fine });
  }

  /* =========================================================================
     THE SEQUENCE
     ====================================================================== */
  function run() {
    root.setAttribute('data-state', 'intro');

    if (reduce) { finish(); return; }

    /* FRAME 01 — the colour atmosphere develops inside the darkness -------- */
    play(el('bg'), [{ opacity: 0 }, { opacity: 1 }],
         { delay: T.bg, duration: 1050, easing: E.atmos });

    /* FRAME 02 + 03 — the photograph develops, then settles ---------------- */
    play(el('girl'), [
      { opacity: 0, transform: 'translate3d(0,16px,0)', easing: E.photo },
      { opacity: 1, transform: 'translate3d(0,-3px,0)', offset: 0.65, easing: E.settle },
      { opacity: 1, transform: 'translate3d(0,0,0)' }
    ], { delay: T.girl, duration: 1150 });

    /* the print coming into focus: sharp copy fades up over the soft one.
       The soft copy is only retired once that crossfade has genuinely
       finished, so a slow frame can never leave a hole in the composition. */
    var sharp = play(q('.girl__img--sharp'), [{ opacity: 0 }, { opacity: 1 }],
                     { delay: T.girl, duration: 1100, easing: E.photo });
    if (sharp && sharp.finished) { sharp.finished.then(retireSoft, retireSoft); }
    else { setTimeout(retireSoft, T.girl + 1400); }

    /* FRAME 04 — ENIGMA is lifted into the composition --------------------- */
    play(el('title'), [
      { opacity: 0, transform: 'translate3d(0,110px,0)', easing: E.lift },
      { opacity: 1, transform: 'translate3d(0,2px,0)', offset: 0.83, easing: E.settle },
      { opacity: 1, transform: 'translate3d(0,0,0)' }
    ], { delay: T.title, duration: 900 });

    /* FRAME 05 / 06 — the title reveals the copy, then the date ------------ */
    rise(el('copy'), T.copy, 7, 520);
    rise(el('date'), T.date, 4, 450);

    /* FRAME 07 — the header arrives from above ----------------------------- */
    drop(el('hdr-l'), T.hdrSide, 10, 580);
    drop(el('hdr-r'), T.hdrSide, 10, 580);
    drop(el('hdr-c'), T.hdrMid,  10, 580);

    /* FRAME 08 — the editorial information assembles itself ---------------- */
    rise(el('bts'),    T.bts,   6, 440);
    rise(el('edn'),    T.edn,   6, 440);
    rise(el('rail'),   T.rail,  5, 440);
    rise(el('foot-l'), T.footL, 5, 440);
    rise(el('foot-c'), T.footC, 5, 440);
    rise(el('foot-r'), T.footR, 5, 440);

    /* the rules draw rather than fade */
    qa('.rail__rule').forEach(function (r, i) {
      play(r, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
           { delay: T.rail + i * 90, duration: 620, easing: E.fine });
    });
    play(q('.bts__rule'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
         { delay: T.bts + 120, duration: 560, easing: E.fine });

    /* FRAME 09 — section navigation: the line draws, the marker settles ---- */
    rise(el('secnav'), T.secnav, 0, 400);
    play(q('.secnav__track'), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
         { delay: T.secnav, duration: 700, easing: E.fine });
    play(q('.secnav__dot'), [
      { opacity: 0, transform: 'scale(.4)' },
      { opacity: 1, transform: 'scale(1)' }
    ], { delay: T.secnav + 320, duration: 420, easing: E.settle });

    /* hero is interactive once the last beat lands (~4.3s), with a hard
       fallback in case a WAAPI promise never resolves */
    var all = animations.filter(Boolean).map(function (a) {
      return a.finished ? a.finished.catch(function () {}) : Promise.resolve();
    });
    Promise.all(all).then(finish);
    setTimeout(finish, 5000);
  }

  /* the active-marker underline is a pseudo-element, so it is driven by CSS  */
  function markUnderline() {
    var style = document.createElement('style');
    style.textContent =
      '[data-state="intro"] .secnav__list a[aria-current]::after,' +
      '[data-state="live"]  .secnav__list a[aria-current]::after{' +
        'transform:scaleX(1);' +
        'transition:transform .62s ' + E.fine + ' ' + ((T.secnav + 260) / 1000) + 's;}';
    document.head.appendChild(style);
  }

  /* =========================================================================
     FINAL STATE — hero becomes interactive
     ====================================================================== */
  function retireSoft() {
    var soft = q('.girl__img--soft');
    if (soft) soft.style.display = 'none';   /* stop rasterising the blur */
  }

  function finish() {
    if (root.getAttribute('data-state') === 'live') return;
    root.setAttribute('data-state', 'live');

    /* release compositor memory held for the entrance */
    qa('[data-in]').forEach(function (n) { n.style.willChange = 'auto'; });
    if (reduce) retireSoft();

    if (!reduce) startParallax();
  }

  /* =========================================================================
     AFTER THE INTRO — restrained pointer parallax.
     Four composited writes per frame; idles as soon as it converges.
     ====================================================================== */
  function startParallax() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var targets = [
      { node: q('.layer--bg'),   amp: 6  },
      { node: q('.layer--girl'), amp: 12 },
      { node: q('.stage'),       amp: 2  },
      { node: q('.title'),       amp: 2  }
    ].filter(function (t) { return !!t.node; });

    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, idle = true;

    function onMove(e) {
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width  - 0.5) * -2; // -1 … 1
      ty = ((e.clientY - r.top)  / r.height - 0.5) * -2;
      if (idle) { idle = false; raf = requestAnimationFrame(tick); }
    }
    function onLeave() {
      tx = 0; ty = 0;
      if (idle) { idle = false; raf = requestAnimationFrame(tick); }
    }
    function tick() {
      cx += (tx - cx) * 0.055;
      cy += (ty - cy) * 0.055;

      for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        t.node.style.setProperty('--px-x', (cx * t.amp).toFixed(2) + 'px');
        t.node.style.setProperty('--px-y', (cy * t.amp).toFixed(2) + 'px');
      }

      if (Math.abs(tx - cx) < 0.0008 && Math.abs(ty - cy) < 0.0008) {
        idle = true;                       // converged — stop burning frames
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', onLeave, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(raf); idle = true; }
    });
  }

  /* =========================================================================
     PRELOAD — the sequence must never wait on an image or a webfont.
     ====================================================================== */
  function ready() {
    var srcs = qa('img').map(function (i) { return i.currentSrc || i.src; });
    var jobs = srcs.map(function (s) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = im.onerror = res;
        im.src = s;
        if (im.decode) { im.decode().then(res).catch(res); }
      });
    });
    if (document.fonts && document.fonts.ready) jobs.push(document.fonts.ready);

    /* never stall the show: 3s ceiling, then start regardless */
    return Promise.race([
      Promise.all(jobs),
      new Promise(function (res) { setTimeout(res, 3000); })
    ]);
  }

  markUnderline();
  ready().then(function () {
    /* two frames of settled layout before the first beat of the sequence */
    requestAnimationFrame(function () { requestAnimationFrame(run); });
  });

})();
