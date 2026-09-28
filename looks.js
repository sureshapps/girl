/* ============================================================================
   ENIGMA — SECTION 04 · ONE LOOK. FOUR MOODS.
   ---------------------------------------------------------------------------
   Four designers orbit the portrait on a tilted ring. The scroll is the only
   motor: it turns the ring; everything else is a consequence.

   Per transition k -> k+1 (f = fractional progress inside it):
     f 0.00-0.55   the ring travels; the outgoing panel retracts at 0.06
     f 0.58        the incoming node seats at the top station (halo)
     f 0.66        its information panel floats in            (CSS 500ms)
     f 0.84        its mood enters the medallion from the LEFT (CSS 750ms)

   Crossing a threshold arms a class; CSS carries the micro-animation to its
   end in either direction, so fast scrolling never truncates a beat and
   scrolling back replays everything mirrored.

   The rAF loop exists only to glide the ring and the parallax — it shuts
   itself off the moment both have settled. Idle is genuinely still.
   ========================================================================== */
(function () {
  'use strict';

  /* =========================================================================
     1 · THE FOUR MOODS  —  the only part you normally need to touch
     Drop looks/01.jpg … 04.jpg in and they replace the placeholder portrait.
     Panel copy is placeholder except Atelier Lumière, which is verbatim from
     the reference.
     ====================================================================== */
  var IMAGE_DIR = 'looks/';
  var FALLBACK  = 'GIRL%20IMAGE.jpg';

  var MOODS = [
    { name:'Editorial',
      focus:'Strong silhouettes and expressive movement.',
      approach:'Considered, directional, modern.',
      avail:'Editorials · Campaigns',                 grade:'noir', op:'30% 22%' },
    { name:'Beauty',
      focus:'Close-up studies of expression, skin and detail.',
      approach:'Precise, intimate, refined.',
      avail:'Beauty · Test shoots',                   grade:'crimson', op:'42% 40%' },
    { name:'Commercial',
      focus:'Character-led work for brand and product.',
      approach:'Effortless, adaptable, direct.',
      avail:'Campaigns · Lifestyle',                  grade:'signature', op:'79% 32%' },
    { name:'Runway',
      focus:'Movement, presence and confidence on the runway.',
      approach:'Composed, powerful, exact.',
      avail:'Shows · Fittings',                       grade:'eclipse', op:'53% 36%' }
  ];

  /* =========================================================================
     2 · GEOMETRY  —  measured from the reference
     ====================================================================== */
  var R      = 231;      /* orbit radius, in design units                    */
  var TILT   = 14;       /* orbit plane tilt: the top of the ring is nearest */
  var STATES = MOODS.length;

  /* thresholds inside one transition */
  var T_OUT = 0.06, T_SEAT = 0.58, T_PANEL = 0.66, T_SWAP = 0.84;

  var GLIDE = 0.14;      /* ring glide toward its scroll-set target          */

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp  = function (v,a,b){ return v<a?a:v>b?b:v; };
  var smooth = function (e0,e1,x){ var t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };

  var section = document.getElementById('looks');
  if (!section) return;
  var stage = section.querySelector('.looks__stage');
  var med   = section.querySelector('.looks__med');
  var face  = section.querySelector('.med__face');
  var rule  = section.querySelector('.looks__rule');

  /* =========================================================================
     3 · BUILD  —  nodes, moods, panels, all from the config
     ====================================================================== */
  var nodes = [], lookEls = [], panelEls = [];

  function h(tag, cls, parent) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (parent) parent.appendChild(el);
    return el;
  }

  MOODS.forEach(function (m, i) {
    /* orbit node: dot + halo + upright two-line label */
    var n = h('div', 'lkn', stage);
    h('i', 'lkn__halo', n);
    h('i', 'lkn__dot',  n);
    var lab = h('div', 'lkn__lab', n);
    lab.innerHTML = m.name.split(' ').join('<br>');
    nodes.push({ el: n, base: i * (360 / STATES), on: false, labLeft: null });

    /* mood layer inside the medallion */
    var lk = h('div', 'look g-' + m.grade, face);
    var im = h('img', null, lk);
    im.alt = ''; im.decoding = 'async'; im.draggable = false;
    im.src = IMAGE_DIR + '0' + (i + 1) + '.jpg';
    im.addEventListener('error', function () {
      if (this.dataset.fell) { this.remove(); return; }
      this.dataset.fell = '1';
      this.src = FALLBACK;                      /* one look, four grades */
    });
    h('i', 'look__wash', lk);
    lookEls.push(lk);

    /* information panel */
    var p = h('article', 'lkp', stage);
    h('i', 'lkp__slab', p);
    var card = h('div', 'lkp__card', p);
    var txt  = h('div', 'lkp__txt', card);
    h('div', 'lkp__name', txt).textContent = m.name;
    [['Focus', m.focus], ['Approach', m.approach], ['Available for', m.avail]]
      .forEach(function (row) {
        var r2 = h('div', 'lkp__row', txt);
        h('div', 'lkp__key', r2).textContent = row[0];
        h('div', 'lkp__val', r2).textContent = row[1];
      });
    var go = h('a', 'lkp__go', txt);
    go.href = '#';
    go.innerHTML = '<span>View full profile</span><i>&#8599;</i>';
    go.addEventListener('click', function (e) {
      e.preventDefault();
      section.dispatchEvent(new CustomEvent('enigma:designer', {
        bubbles: true, detail: { index: i, name: m.name }
      }));
    });
    var pim = h('div', 'lkp__img', card);
    var im2 = h('img', null, pim);
    im2.alt = m.name; im2.decoding = 'async'; im2.draggable = false;
    im2.src = IMAGE_DIR + '0' + (i + 1) + '.jpg';
    im2.addEventListener('error', function () {
      if (this.dataset.fell) { this.remove(); return; }
      this.dataset.fell = '1';
      this.src = FALLBACK;
    });
    panelEls.push(p);
  });

  /* =========================================================================
     4 · STATE  —  scroll position is the single source of truth
     ====================================================================== */
  var spin = 0, spinT = 0;              /* ring angle, degrees              */
  var px = 0, py = 0, tx = 0, ty = 0;   /* parallax                         */
  var KU = 1, lit = false, visible = false;
  var running = false, raf = 0;
  var sActive = 0, sPanel = 0, sImage = 0;

  function readUnit() {
    KU = parseFloat(getComputedStyle(section).getPropertyValue('--ku')) || 1;
  }

  function progress() {
    var r = section.getBoundingClientRect(), vh = innerHeight || 1;
    var run = (section.offsetHeight - vh) || 1;
    return clamp(-r.top / run, 0, 1) * (STATES - 1);
  }

  function apply() {
    var P = progress();
    var k = Math.min(STATES - 2, Math.floor(P));
    if (P <= 0) k = 0;
    var f = clamp(P - k, 0, 1);

    /* the ring: most of its travel happens in the first 55% of a state */
    spinT = -(k + smooth(0, 0.55, f)) * (360 / STATES);

    var active = f >= T_SEAT ? k + 1 : k;
    var panel  = f < T_OUT ? k : (f >= T_PANEL ? k + 1 : -1);
    var image  = f >= T_SWAP ? k + 1 : k;
    if (P <= 0) { active = 0; panel = 0; image = 0; }

    if (active !== sActive) {
      sActive = active;
      section.dataset.active = String(active);
      if (rule) rule.style.setProperty('--pip', (30 + active * 14) + '%');
    }
    if (panel !== sPanel) {
      sPanel = panel;
      for (var i = 0; i < panelEls.length; i++)
        panelEls[i].classList.toggle('is-in', i === panel);
    }
    if (image !== sImage) {
      sImage = image;
      for (var j = 0; j < lookEls.length; j++) {
        lookEls[j].classList.toggle('is-front', j === image);
        lookEls[j].classList.toggle('is-gone',  j <  image);
      }
    }
  }

  /* node placement on the tilted orbit — top of the ring is nearest */
  var tiltS = Math.sin(TILT * Math.PI / 180);
  var tiltC = Math.cos(TILT * Math.PI / 180);

  function paint() {
    section.style.setProperty('--spin', spin.toFixed(2));
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var t = (n.base + spin) * Math.PI / 180;
      var x  = R * Math.sin(t);
      var yp = -R * Math.cos(t);
      var y  = yp * tiltC;
      /* +16u camera bias: a node must never lie exactly in the orbit
         plane's z=0 intersection, where Chrome's 3D sorter can cull it   */
      var z  = -yp * tiltS + 16;
      var zN = (z / (R * tiltS) + 1) / 2;         /* 0 back … 1 front       */
      n.el.style.transform = 'translate3d(' + (x * KU).toFixed(1) + 'px,'
                           + (y * KU).toFixed(1) + 'px,' + (z * KU).toFixed(1) + 'px)'
                           + ' scale(' + (0.86 + 0.24 * zN).toFixed(3) + ')';
      n.el.style.setProperty('--no', (0.42 + 0.58 * zN).toFixed(2));

      var seated = Math.abs(((n.base + spin) % 360 + 360) % 360) < 14 ||
                   Math.abs(((n.base + spin) % 360 + 360) % 360) > 346;
      var on = seated && i === sActive;
      if (on !== n.on) { n.el.classList.toggle('is-on', on); n.on = on; }

      var left = x < -60;
      if (left !== n.labLeft) { n.el.classList.toggle('lab-left', left); n.labLeft = left; }
    }
    /* the medallion leans with the ring's remaining momentum */
    var sway = clamp((spinT - spin) * 0.20, -5, 5);
    if (med) med.style.setProperty('--sway', sway.toFixed(2) + 'deg');
  }

  /* =========================================================================
     5 · LOOP  —  glide, then stop dead
     ====================================================================== */
  function frame() {
    if (!running) return;

    spin += (spinT - spin) * (reduce ? 1 : GLIDE);
    if (Math.abs(spinT - spin) < 0.01) spin = spinT;
    px += (tx - px) * 0.07;
    py += (ty - py) * 0.07;
    section.style.setProperty('--px', (px * 1.3).toFixed(2) + '%');
    section.style.setProperty('--py', (py * 1.0).toFixed(2) + '%');
    section.style.setProperty('--ox', (px * 2.2).toFixed(2) + 'deg');
    section.style.setProperty('--oy', (py * 1.6).toFixed(2) + 'deg');

    paint();

    var busy = Math.abs(spinT - spin) > 0.005
            || Math.abs(tx - px) > 0.002
            || Math.abs(ty - py) > 0.002;
    if (!busy) { running = false; return; }
    raf = requestAnimationFrame(frame);
  }
  function start(){ if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  /* =========================================================================
     6 · SCROLL + POINTER
     ====================================================================== */
  function onScroll() {
    var r = section.getBoundingClientRect(), vh = innerHeight || 1;
    var shown = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    visible = shown > 0;
    if (!lit && shown / vh > 0.3) { lit = true; section.classList.add('is-lit'); }
    apply();
    if (visible) start(); else stop();
  }
  addEventListener('scroll', onScroll, { passive: true });
  if (window.IntersectionObserver) {
    new IntersectionObserver(onScroll, { threshold: [0, .25, .5, .75, 1] })
      .observe(section);
  }

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

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (visible) start();
  });

  var rt;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { readUnit(); apply(); paint(); onScroll(); }, 200);
  });

  /* =========================================================================
     7 · GO  —  assembled and still until the visitor scrolls
     ====================================================================== */
  readUnit();
  section.dataset.active = '0';
  panelEls[0].classList.add('is-in');
  lookEls[0].classList.add('is-front');
  if (rule) rule.style.setProperty('--pip', '30%');
  apply();
  spin = spinT;                 /* no opening ring-lurch */
  paint();
  onScroll();

})();
