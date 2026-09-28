/* ============================================================================
   ENIGMA — SPATIAL SECTIONS
   Section 02 · the archive room
   ---------------------------------------------------------------------------
   The volume engine. Screens sit at arbitrary (x,y,z) inside a
   rectangular volume that turns about a vertical axis D in front of the
   camera. Depth — not rotation — carries the perspective: a panel's nearest
   pass renders up to 1.44x and its farthest 0.29x.

   Per frame this writes ONE inherited --spin (which drives both the room's
   rotation and every panel's counter-rotation) plus depth-quantised opacity.
   ========================================================================== */
(function () {
  'use strict';

  /* =========================================================================
     1 · IMAGERY  —  the only part you normally need to touch
     ====================================================================== */
  var FALLBACK = 'GIRL%20IMAGE.jpg';

  /* Drop 01.jpg … 24.jpg into /archive and they appear automatically. Any
     missing slot falls back, so the volume always renders.                */
  var SETS = {
    archive: { dir: 'archive/', count: 11, ext: '.jpg' }
  };
  /* per-work framing so no face is lost in the 4/3 panel crop */
  var OPS = ['50% 26%','52% 22%','50% 30%','55% 34%','36% 24%','55% 30%',
             '22% 35%','62% 36%','80% 32%','42% 38%','34% 24%'];
  function srcFor(set, i) {
    var s = SETS[set], n = (i % s.count) + 1;
    return s.dir + (n < 10 ? '0' : '') + n + s.ext;
  }

  /* the four working categories, cycled across the archive */
  var CATS = ['Editorial', 'Beauty', 'Campaign', 'Runway'];
  var TAGS = [
    'SILHOUETTE · COMPOSITION · MOVEMENT',
    'EXPRESSION · SKIN · DETAIL',
    'CHARACTER · PRODUCT · IDENTITY',
    'PRESENCE · CONFIDENCE · MOTION'
  ];

  /* =========================================================================
     2 · SECTION 02 — THE ARCHIVE ROOM
     A volume, not a ring: radius runs 500 → 1600 and height -330 → +330, so
     no two screens share an orbit and the cylinder never resolves.
     [ angle°, radius, y, width, ownYaw°, tilt° ]
     ====================================================================== */
  var ARCHIVE = [
    /* OUTER SHELL — these sweep closest to the camera, so every one of them
       carries a large |y|: they pass above or below the central corridor and
       never block the view into the room. */
    [  6, 1380,  268, 380,  12,  4], [ 43, 1290, -300, 360,   9,  3],
    [ 82, 1420,  240, 395,  11, -3], [119, 1310, -340, 350,  -8,  3],
    [157, 1395,  300, 385,  -6, -4], [196, 1265, -250, 345,   7,  3],
    [238, 1410,  225, 390, -10, -3], [279, 1300, -330, 355,   8,  4],
    [321, 1355,  285, 370, -11, -3],
    /* THE BODY OF THE ROOM */
    [ 24,  980, -160, 320,  -5,  2], [ 66, 1060,  120, 335,   9,  1],
    [101,  865,  310, 300,   4,  4], [143, 1015, -110, 325,  -8,  2],
    [188,  920,  190, 310,   6,  3], [226, 1070,  -70, 340, -10,  1],
    [264,  855,  295, 295,   5,  3], [307,  995, -290, 315,  -6, -2],
    [345,  905,   80, 305,   7,  2],
    /* THE DEEP ARCHIVE — small, dark, and the only thing that ever occupies
       the corridor, so you always see distance through the middle. */
    [ 33,  640,  -30, 265,   4,  1], [ 79,  545,  215, 245,  -3,  2],
    [128,  700, -195, 270,   6,  1], [174,  505,   95, 240,  -5,  2],
    [211,  675,  -60, 268,   3,  1], [256,  580,  270, 250,  -4,  2],
    [298,  710, -255, 272,   5,  1], [336,  520,  150, 242,  -3,  2]
  ];

  /* =========================================================================
     3 · MOTION
     ====================================================================== */
  var CFG = {
    archive: { auto: 360/150, dolly: 620, spinUp: 1.0, drag: 0.085, scroll: 0.030 }
  };
  var DAMPING = 2.0, MAX_INERTIA = 90, MOUSE_MAX = 13;   /* px of parallax  */
  var P_UNITS = 1150;                                     /* --persp in au  */

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ease   = function (t) { return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3); };
  var clamp  = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  /* =========================================================================
     4 · A VOLUME
     ====================================================================== */
  function Space(sectionId, kind, layout, imgSet, opts) {
    var el = document.getElementById(sectionId);
    if (!el) return null;
    var self = this;
    opts = opts || {};

    this.el      = el;
    this.kind    = kind;
    this.cfg     = CFG[kind];
    this.axis    = opts.axis || 1250;
    this.scene   = el.querySelector('.space__scene');
    this.room    = el.querySelector('.space__room');
    this.wall    = el.querySelector('.space__wall');
    this.ui      = el.querySelector('.space__ui');
    this.labels  = !!opts.labels;

    this.spin = 0; this.inertia = 0; this.spinUp = 0;
    this.mx = 0; this.my = 0; this.cmx = 0; this.cmy = 0;
    this.scrollDolly = 0; this.dolly = 0;
    this.revealT = -1; this.running = false; this.visible = false;
    this.raf = 0; this.last = 0; this.exitMul = 1; this.frozen = false;
    this.panels = []; this.current = -1;

    /* ---- build ---------------------------------------------------------- */
    this.build = function (max) {
      self.room.textContent = '';
      self.panels.length = 0;
      self.current = -1;

      var list = layout.slice(0, max || layout.length);
      list.forEach(function (spec, i) {
        var x, y, z, w, yaw, tilt, ar;
        if (Array.isArray(spec)) {                 /* polar (section 02) */
          var a = spec[0] * Math.PI / 180, r = spec[1];
          x = Math.sin(a) * r; z = Math.cos(a) * r;
          y = spec[2]; w = spec[3]; yaw = spec[4]; tilt = spec[5]; ar = '4/3';
        } else {                                    /* cartesian (03)    */
          x = spec.x; y = spec.y; z = spec.z; w = spec.w;
          yaw = spec.yaw; tilt = spec.tilt; ar = spec.ar;
        }

        var p = document.createElement('article');
        p.className = 'pan';
        p.style.cssText =
          '--x:' + x.toFixed(1) + ';--y:' + y + ';--z:' + z.toFixed(1) +
          ';--w:' + w + ';--yaw:' + yaw + 'deg;--tilt:' + tilt + 'deg' +
          ';--ar:' + ar + ';--th:' + (w > 340 ? 4 : w > 260 ? 3 : 2);

        var cast = document.createElement('i'); cast.className = 'pan__cast';
        var slab = document.createElement('i'); slab.className = 'pan__slab';
        var frame = document.createElement('div'); frame.className = 'pan__frame';

        var im = document.createElement('img');
        im.alt = ''; im.decoding = 'async'; im.draggable = false;
        im.src = srcFor(imgSet, i);
        var op = OPS[i % SETS.archive.count];
        if (op) p.style.setProperty('--op', op);
        im.addEventListener('error', function () {
          if (this.dataset.fell) return;
          this.dataset.fell = '1';
          this.src = FALLBACK;
        });
        im.addEventListener('load', function () {
          if (this.naturalWidth && this.naturalHeight && !spec.ar) {
            this.closest('.pan').style.setProperty(
              '--ar', this.naturalWidth + '/' + this.naturalHeight);
          }
        });
        frame.appendChild(im);

        var veil = document.createElement('i'); veil.className = 'pan__veil';
        frame.appendChild(veil);

        p.appendChild(cast); p.appendChild(slab); p.appendChild(frame);

        if (self.labels) {
          var l = document.createElement('div'); l.className = 'pan__label';
          var b = document.createElement('b');
          b.textContent = CATS[i % CATS.length] + ' ' + (i + 1 < 10 ? '0' : '') + (i + 1);
          var s2 = document.createElement('span');
          s2.textContent = TAGS[i % TAGS.length];
          l.appendChild(b); l.appendChild(s2); p.appendChild(l);
        }
        p.dataset.index = i;

        self.room.appendChild(p);
        self.panels.push({
          el: p, veil: veil, frame: frame, img: im,
          x: x, y: y, z: z, lastO: -1, lastV: -1, near: false, depth: ''
        });
      });

      /* the count reads "04 Categories" from the markup — not panel count */
    };

    /* ---- depth, straight from the 3D position ---------------------------- */
    var S_NEAR = P_UNITS / (P_UNITS - 350);      /* 1.44 */
    var S_FAR  = P_UNITS / (P_UNITS + 2850);     /* 0.29 */

    this.paint = function () {
      var rad = self.spin * Math.PI / 180;
      var sn = Math.sin(rad), cs = Math.cos(rad);
      var D  = self.axis - self.dolly;      /* both in au units */
      var bestS = -1, bestI = -1;

      for (var i = 0; i < self.panels.length; i++) {
        var p = self.panels[i];
        /* rotateY then translateZ(-D): exactly what the CSS does */
        var zc = (-p.x * sn + p.z * cs) - D;
        var s  = P_UNITS / Math.max(P_UNITS - zc, 120);

        var t = clamp((s - S_FAR) / (S_NEAR - S_FAR), 0, 1);
        /* opacity and veil compound, so each carries only part of the falloff:
           front 1.00 · near 0.67 · middle 0.46 · deep 0.20 · far 0.08        */
        var o = (0.30 + 0.70 * Math.pow(t, 0.90)) * self.reveal(i) * self.exitMul;
        var v = 0.72 * Math.pow(1 - t, 1.15);

        var qo = Math.round(o * 100) / 100, qv = Math.round(v * 100) / 100;
        if (qo !== p.lastO) { p.el.style.setProperty('--o', qo); p.lastO = qo; }
        if (qv !== p.lastV) { p.veil.style.setProperty('--v', qv); p.lastV = qv; }

        var d = s > 0.95 ? 'near' : s > 0.62 ? 'mid' : 'far';
        if (d !== p.depth) { p.el.dataset.depth = d; p.depth = d; }
        var near = s > 0.85;
        if (near !== p.near) { p.el.classList.toggle('is-near', near); p.near = near; }

        if (s > bestS) { bestS = s; bestI = i; }
      }

      if (bestI !== self.current) {
        if (self.current >= 0) self.panels[self.current].el.classList.remove('is-front');
        self.current = bestI;
        if (bestI >= 0) self.panels[bestI].el.classList.add('is-front');
      }
    };

    /* staged reveal: the deep archive first, the near screens last */
    this.reveal = function (i) {
      if (self.revealT < 0) return 0;
      if (self.revealT >= 3) return 1;
      var p = self.panels[i];
      var far = 1 - clamp((Math.hypot(p.x, p.z)) / 1600, 0, 1);   /* 1 = deep */
      return ease((self.revealT - 0.15 - far * 0.05 - (1 - far) * 0.42) / 0.55);
    };

    /* ---- loop ------------------------------------------------------------ */
    this.frame = function (now) {
      if (!self.running) return;
      /* never trust the clock to move forward: a backwards timestamp would
         drive the reveal negative and strand the section unlit */
      var dt = clamp((now - self.last) / 1000, 0, 0.05) || 0.016;
      self.last = now;

      if (self.revealT >= 0 && self.revealT < 3) {
        self.revealT += dt;
        var e = ease(self.revealT / 0.5) * self.exitMul;
        self.scene.style.opacity = e.toFixed(3);
        if (self.wall) self.wall.style.opacity = (e * 0.9).toFixed(3);
        if (self.ui) self.ui.style.opacity = ease((self.revealT - 0.9) / 0.5).toFixed(3);
      }

      if (!self.dragging && !self.frozen) {
        self.spinUp = Math.min(1, self.spinUp + dt / self.cfg.spinUp);
        var auto = reduce ? 0 : self.cfg.auto * ease(self.spinUp);
        self.spin += (auto + self.inertia) * dt;
        self.inertia -= self.inertia * Math.min(1, DAMPING * dt);
        if (Math.abs(self.inertia) < 0.02) self.inertia = 0;
      }
      self.spin = ((self.spin % 360) + 360) % 360;

      /* camera: pointer parallax + the dolly the scroll pushes */
      self.cmx += (self.mx - self.cmx) * 0.06;
      self.cmy += (self.my - self.cmy) * 0.06;
      self.dolly += (self.scrollDolly - self.dolly) * 0.07;

      var sty = self.el.style;
      sty.setProperty('--spin', self.spin.toFixed(3));
      sty.setProperty('--cam-x', (47 - self.cmx * 3.2).toFixed(2) + '%');
      sty.setProperty('--cam-y', (58 - self.cmy * 2.4).toFixed(2) + '%');
      sty.setProperty('--dolly', self.dolly.toFixed(1));
      if (self.wall) {
        sty.setProperty('--wall-x', (self.cmx * MOUSE_MAX * 0.45).toFixed(1) + 'px');
        sty.setProperty('--wall-y', (self.cmy * MOUSE_MAX * 0.30).toFixed(1) + 'px');
      }

      self.paint();
      self.raf = requestAnimationFrame(self.frame);
    };

    this.start = function () {
      if (self.running) return;
      self.running = true; self.last = performance.now();
      self.raf = requestAnimationFrame(self.frame);
    };
    this.stop = function () { self.running = false; cancelAnimationFrame(self.raf); };

    this.wake = function () {
      if (self.revealT >= 0) return;
      if (reduce) {
        self.revealT = 3; self.scene.style.opacity = 1;
        if (self.wall) self.wall.style.opacity = .9;
        if (self.ui) self.ui.style.opacity = 1;
        self.spinUp = 1;
      } else { self.revealT = 0; }
      self.start();
    };

    /* ---- interaction ----------------------------------------------------- */
    this.dragging = false;
    var dragId = null, dragX = 0, dragT = 0, dragV = 0, moved = 0, justDragged = false;

    el.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || self.dragging) return;
      var r = el.getBoundingClientRect();
      self.mx = ((e.clientX - r.left) / r.width - 0.5) * -2;
      self.my = ((e.clientY - r.top) / r.height - 0.5) * -2;
    }, { passive: true });
    el.addEventListener('pointerleave', function () { self.mx = self.my = 0; }, { passive: true });

    el.addEventListener('pointerover', function (e) {
      if (e.target.closest('.pan.is-near')) el.classList.add('is-hovering');
    });
    el.addEventListener('pointerout', function (e) {
      if (!e.relatedTarget || !e.relatedTarget.closest('.pan.is-near'))
        el.classList.remove('is-hovering');
    });

    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      self.dragging = true; dragId = e.pointerId;
      dragX = e.clientX; dragT = performance.now(); dragV = 0; moved = 0;
      justDragged = false;
      el.classList.add('is-dragging', 'is-engaged');
      try { el.setPointerCapture(dragId); } catch (err) {}
    });
    el.addEventListener('pointermove', function (e) {
      if (!self.dragging || e.pointerId !== dragId) return;
      var now = performance.now(), dx = e.clientX - dragX;
      var dt = Math.max(1, now - dragT);
      dragX = e.clientX; dragT = now; moved += Math.abs(dx);
      self.spin -= dx * self.cfg.drag;
      dragV = (-dx * self.cfg.drag) / (dt / 1000);
    });
    function endDrag(e) {
      if (!self.dragging || (e && e.pointerId !== dragId)) return;
      self.dragging = false;
      el.classList.remove('is-dragging');
      try { el.releasePointerCapture(dragId); } catch (err) {}
      self.inertia = clamp(dragV * 0.5, -MAX_INERTIA, MAX_INERTIA);
      justDragged = moved > 6;
      dragId = null;
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    this.wasDrag = function () { var d = justDragged; justDragged = false; return d; };

    /* ---- visibility, scroll travel, exit ---------------------------------- */
    this.onScroll = function (delta) {
      var r = el.getBoundingClientRect(), h = innerHeight || 1;
      var shown = Math.min(r.bottom, h) - Math.max(r.top, 0);
      var ratio = shown / Math.min(r.height || h, h);
      self.visible = shown > 0;
      if (ratio > 0.3) self.wake();
      if (self.visible) { if (self.revealT >= 0) self.start(); } else self.stop();

      if (self.visible && !self.dragging && delta) {
        /* scrolling travels through the volume and turns it, it does not
           merely spin a carousel                                          */
        self.inertia = clamp(self.inertia + delta * self.cfg.scroll,
                             -MAX_INERTIA, MAX_INERTIA);
        el.classList.add('is-engaged');
      }
      /* how far through the section we are: 0 arriving, 1 leaving */
      var prog = clamp((h - r.top) / (h + (r.height || h)), 0, 1);
      self.scrollDolly = (prog - 0.5) * 2 * self.cfg.dolly;

      var t = r.bottom < h ? clamp(1 - r.bottom / h, 0, 1) : 0;
      self.exitMul = 1 - t * 0.94;
      if (self.revealT >= 3) {
        self.scene.style.opacity = self.exitMul.toFixed(3);
        if (self.wall) self.wall.style.opacity = (self.exitMul * 0.9).toFixed(3);
      }
    };

    this.build();
    this.paint();
    return this;
  }

  /* =========================================================================
     5 · BUILD THE ARCHIVE
     ====================================================================== */
  function budget(n) {
    var w = innerWidth;
    if (w <= 640)  return Math.min(n, 14);
    if (w <= 1024) return Math.min(n, 20);
    return n;
  }

  var archive = new Space('archive', 'archive', ARCHIVE, 'archive',
                          { axis: 1250, labels: true });
  if (!archive) return;
  var spaces = [archive];
  archive.build(budget(ARCHIVE.length));
  archive.paint();

  /* =========================================================================
     6 · CLICKING A SCREEN
     A navigation intent, not a modal. Section 03 does not exist — this is the
     connection point whatever comes next will attach to.
     ====================================================================== */
  archive.el.addEventListener('click', function (e) {
    if (archive.wasDrag()) return;
    var p = e.target.closest('.pan.is-near');
    if (!p) return;
    archive.el.dataset.selected = p.dataset.index || '';
    archive.el.dispatchEvent(new CustomEvent('enigma:select', {
      bubbles: true, detail: { index: Number(p.dataset.index || 0), from: 2, to: 3 }
    }));
  });

  /* =========================================================================
     7 · SECTION NAVIGATION  —  01 … 06
     ====================================================================== */
  var SECTIONS = [
    { n: 1, el: document.getElementById('hero') },
    { n: 2, el: archive.el },
    { n: 3, el: document.getElementById('folio') },
    { n: 4, el: document.getElementById('looks') },
    { n: 5, el: document.getElementById('behind') },
    { n: 6, el: document.getElementById('story') }
  ].filter(function (s) { return !!s.el; });

  var navLinks = [].slice.call(document.querySelectorAll('.secnav__list a'));
  navLinks.forEach(function (a, i) {
    var target = SECTIONS[i];
    if (!target) { a.setAttribute('aria-disabled', 'true'); return; }
    a.addEventListener('click', function (e) {
      e.preventDefault();
      target.el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* content links across the page scroll smoothly to their targets */
  Array.prototype.forEach.call(document.querySelectorAll('a[data-scroll]'),
    function (a) {
      a.addEventListener('click', function (e) {
        var el = document.querySelector(a.getAttribute('href'));
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    });

  function markSection() {
    var mid = innerHeight / 2, best = SECTIONS[0];
    SECTIONS.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) best = s;
    });
    navLinks.forEach(function (a, i) {
      if (best && i === best.n - 1) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  /* =========================================================================
     8 · GO
     ====================================================================== */
  var lastY = scrollY;
  function onScroll() {
    var y = scrollY, d = y - lastY; lastY = y;
    spaces.forEach(function (s) { s.onScroll(d); });
    markSection();
  }
  addEventListener('scroll', onScroll, { passive: true });

  var rebuildT;
  addEventListener('resize', function () {
    clearTimeout(rebuildT);
    rebuildT = setTimeout(function () {
      var keep = archive.spin;
      archive.build(budget(ARCHIVE.length));
      archive.spin = keep; archive.paint();
      onScroll();
    }, 220);
  });

  document.addEventListener('visibilitychange', function () {
    spaces.forEach(function (s) {
      if (document.hidden) s.stop(); else if (s.revealT >= 0 && s.visible) s.start();
    });
  });

  /* IntersectionObserver is only a hint — some embedding contexts never
     deliver it, so measurement decides                                    */
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function () { onScroll(); },
                                      { threshold: [0, .25, .5, .75, 1] });
    spaces.forEach(function (s) { io.observe(s.el); });
  }

  onScroll();
  markSection();

})();
