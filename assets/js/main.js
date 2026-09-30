/* ==========================================================================
   NARAYANA SCHOOLS — motion layer
   GSAP 3.13 (ScrollTrigger · SplitText · CustomEase · Flip · Observer) + Lenis
   Every module is independently guarded: if a library or node is missing the
   page degrades to a perfectly readable static document.
   ========================================================================== */
(function () {
  'use strict';

  /* ── environment ─────────────────────────────────────────────────────── */
  var HAS_GSAP = typeof window.gsap !== 'undefined';
  var HAS_ST   = HAS_GSAP && typeof window.ScrollTrigger !== 'undefined';
  var HAS_SPLIT= HAS_GSAP && typeof window.SplitText !== 'undefined';
  var REDUCED  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TOUCH    = window.matchMedia('(hover: none)').matches;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  if (HAS_ST) gsap.registerPlugin(ScrollTrigger);
  if (HAS_SPLIT) gsap.registerPlugin(SplitText);
  if (HAS_GSAP && window.CustomEase) {
    gsap.registerPlugin(CustomEase);
    CustomEase.create('swift', '0.16,1,0.3,1');
    CustomEase.create('gentle', '0.33,1,0.68,1');
  }
  var EASE = (HAS_GSAP && window.CustomEase) ? 'swift' : 'power3.out';

  /* ══════════════════════════════════════════ 01 · smooth scroll (Lenis) ══ */
  var lenis = null;

  function initLenis() {
    if (REDUCED || typeof window.Lenis === 'undefined') return;

    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6,
      wheelMultiplier: 1,
      lerp: 0.1
    });

    if (HAS_ST) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  function scrollTo(target, offset) {
    var el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    var off = offset || -(parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-h')) * 16 || 76);
    if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.3 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset + off, behavior: 'smooth' });
  }

  // intercept every in-page anchor
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#' || id.length < 2) return;
      var el = $(id);
      if (!el) return;
      e.preventDefault();
      closeDrawer();
      closeMega();
      scrollTo(el);
    });
  });

  /* ═══════════════════════════════════════════════ 02 · text splitting ══ */
  /**
   * Reveal helper. Uses GSAP SplitText when available (with autoSplit so the
   * lines re-measure on resize / late font load), otherwise falls back to a
   * whole-element fade so nothing is ever left invisible.
   */
  function revealLines(el, opts) {
    opts = opts || {};
    var trigger = opts.trigger || el;
    var start   = opts.start || 'top 85%';

    if (REDUCED || !HAS_GSAP) return;

    if (!HAS_SPLIT) {
      gsap.from(el, {
        y: 24, autoAlpha: 0, duration: 1, ease: EASE,
        scrollTrigger: HAS_ST ? { trigger: trigger, start: start, once: true } : null
      });
      return;
    }

    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'sp-line',
      autoSplit: true,
      onSplit: function (self) {
        return gsap.from(self.lines, {
          yPercent: 108,
          duration: 1.05,
          ease: EASE,
          stagger: 0.075,
          scrollTrigger: HAS_ST ? { trigger: trigger, start: start, once: true } : null
        });
      }
    });
  }

  /** Split to chars and hand the chars back — used for the hero and CTA titles. */
  function splitChars(el) {
    if (!HAS_SPLIT || !HAS_GSAP) return null;
    var s = new SplitText(el, { type: 'chars,words', charsClass: 'sp-char' });
    return s.chars;
  }

  /* ══════════════════════════════════════════════════ 03 · preloader ══ */
  function initLoader(onReveal, onDone) {
    var loader = $('#loader');
    var numEl  = $('#loaderNum');
    var barEl  = $('#loaderBar');

    var finishAll = function () {
      document.body.classList.remove('is-loading');
      if (loader) loader.style.display = 'none';
      if (HAS_ST) ScrollTrigger.refresh();
      onDone();
    };

    if (!loader) { onReveal(); finishAll(); return; }

    // tells the inline <head> failsafe to stand down
    loader.setAttribute('data-handled', '');

    if (REDUCED || !HAS_GSAP) { onReveal(); finishAll(); return; }

    var ink   = $('.loader__layer--ink', loader);
    var lines = $$('.loader__word b', loader);
    var state = { v: 0 };
    var finished = false;

    gsap.from(lines, { yPercent: 110, duration: 1.1, ease: EASE, stagger: 0.1, delay: 0.2 });
    gsap.from('.loader__top > *, .loader__foot', { autoAlpha: 0, y: 10, duration: 0.8, ease: EASE, stagger: 0.06, delay: 0.3 });

    var counter = gsap.to(state, {
      v: 100,
      duration: 2.4,
      ease: 'power2.inOut',
      onUpdate: function () {
        if (numEl) numEl.textContent = Math.round(state.v);
        if (barEl) barEl.style.transform = 'scaleX(' + (state.v / 100) + ')';
      }
    });

    function finish() {
      if (finished) return;
      finished = true;
      gsap.to(counter, { progress: 1, duration: 0.45, ease: 'power2.in', onComplete: out });
    }

    // hero intro fires mid-wipe so the reveal and the entrance read as one move
    function out() {
      var tl = gsap.timeline({ onComplete: finishAll });
      tl.to(lines, { yPercent: -110, duration: 0.55, ease: 'power3.in', stagger: 0.05 }, 0)
        .to('.loader__mark, .loader__top > *, .loader__foot', { autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, 0)
        .to(ink, { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, 0.3)
        .call(onReveal, null, 0.5);
    }

    // let the counter play out even on an instant load, but never hang past 5s
    var minDone = false, loaded = document.readyState === 'complete';
    var tryFinish = function () { if (minDone && loaded) finish(); };
    gsap.delayedCall(2.2, function () { minDone = true; tryFinish(); });
    if (!loaded) window.addEventListener('load', function () { loaded = true; tryFinish(); });
    gsap.delayedCall(5, finish);
  }

  /* ══════════════════════════════════════════════════ 05 · magnetic ══ */
  function initMagnetic() {
    if (TOUCH || REDUCED || !HAS_GSAP) return;

    $$('.magnetic').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.5);
      });
      el.addEventListener('mouseleave', function () { xTo(0); yTo(0); });
    });
  }

  /* ═════════════════════════════════════════════════════════ 06 · nav ══ */
  var megaOpen = null;

  function closeMega() {
    if (!megaOpen) return;
    megaOpen.panel.classList.remove('is-open');
    megaOpen.panel.setAttribute('aria-hidden', 'true');
    megaOpen.btn.setAttribute('aria-expanded', 'false');
    megaOpen = null;
  }

  function closeDrawer() {
    var d = $('#drawer'), b = $('#burger');
    if (!d || !d.classList.contains('is-open')) return;
    d.classList.remove('is-open');
    d.setAttribute('aria-hidden', 'true');
    if (b) b.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
    if (lenis) lenis.start();
  }

  function initNav() {
    var nav = $('#nav');
    if (!nav) return;

    /* solid + auto-hide; stays in its light-on-dark style for the whole hero */
    var hero = $('.hs');
    var last = window.pageYOffset;
    var onScroll = function () {
      var y = window.pageYOffset;
      var overHero = hero && y < hero.offsetHeight - nav.offsetHeight;
      nav.classList.toggle('is-solid', y > 40);
      nav.classList.toggle('is-light', !!overHero);

      // ignore sub-pixel jitter so the bar doesn't bounce between states
      var dy = y - last;
      if (Math.abs(dy) < 6) return;
      if (y > 400 && dy > 0 && !megaOpen) nav.classList.add('is-hidden');
      else if (dy < 0 || y <= 400) nav.classList.remove('is-hidden');
      last = y;
    };
    if (lenis) lenis.on('scroll', onScroll);
    else window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* mega menu */
    $$('[data-mega]').forEach(function (btn) {
      var panel = $('[data-mega-panel="' + btn.getAttribute('data-mega') + '"]');
      if (!panel) return;

      var open = function () {
        closeMega();
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        btn.setAttribute('aria-expanded', 'true');
        megaOpen = { panel: panel, btn: btn };
      };

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (megaOpen && megaOpen.panel === panel) closeMega(); else open();
      });
      btn.addEventListener('mouseenter', open);

      var leaveTimer;
      [btn, panel].forEach(function (n) {
        n.addEventListener('mouseleave', function () {
          leaveTimer = setTimeout(closeMega, 220);
        });
        n.addEventListener('mouseenter', function () { clearTimeout(leaveTimer); });
      });
    });

    document.addEventListener('click', function (e) {
      if (megaOpen && !megaOpen.panel.contains(e.target)) closeMega();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeMega(); closeDrawer(); }
    });

    /* mobile drawer */
    var burger = $('#burger'), drawer = $('#drawer');
    if (burger && drawer) {
      burger.addEventListener('click', function () {
        var isOpen = drawer.classList.contains('is-open');
        if (isOpen) { closeDrawer(); return; }
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        burger.setAttribute('aria-expanded', 'true');
        document.body.classList.add('is-locked');
        if (lenis) lenis.stop();
      });
    }

    /* active section link */
    if (!HAS_ST) return;
    $$('.nav__links a[data-nav]').forEach(function (link) {
      var sec = $(link.getAttribute('href'));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: function (self) { link.classList.toggle('is-active', self.isActive); }
      });
    });
  }

  /* ═══════════════════════════════════════════════ 07 · hero slider ══ */
  /**
   * Three full-bleed slides. The incoming image clip-wipes across while
   * counter-sliding against the outgoing one (a parallax curtain), a gold
   * edge rides the seam, and the copy leaves/arrives through line masks.
   * Returns { intro } so the preloader can fire the first entrance once
   * its curtain is up; initial hidden states are set immediately so nothing
   * flashes underneath it.
   */
  function initHeroSlider() {
    var hero = $('[data-slider]');
    if (!hero) return null;

    var slides  = $$('[data-slide]', hero);
    var tabs    = $$('[data-hs-to]', hero);
    var curEl   = $('[data-hs-cur]', hero);
    var edge    = $('.hs__edge', hero);
    var ui      = $('.hs__ui', hero);
    var prevBtn = $('[data-hs-prev]', hero);
    var nextBtn = $('[data-hs-next]', hero);
    var total   = slides.length;
    if (total < 2) return null;

    var AUTOPLAY = parseFloat(hero.getAttribute('data-autoplay')) || 7;
    var SIMPLE   = REDUCED || !HAS_GSAP;

    var index = 0, busy = false, inView = true, hovering = false, hidden = false;
    var progress = null, burns = null, tl = null, lastOut = null;

    var pad = function (n) { return String(n + 1).padStart(2, '0'); };

    function setActive(i) {
      slides.forEach(function (s, k) {
        var on = k === i;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
      });
      tabs.forEach(function (t, k) {
        t.classList.toggle('is-active', k === i);
        if (k === i) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
      });
    }

    function bind(goFn) {
      tabs.forEach(function (t, k) {
        t.addEventListener('click', function () { goFn(k, k > index ? 1 : -1); });
      });
      if (prevBtn) prevBtn.addEventListener('click', function () { goFn(index - 1, -1); });
      if (nextBtn) nextBtn.addEventListener('click', function () { goFn(index + 1, 1); });

      document.addEventListener('keydown', function (e) {
        if (!inView) return;
        var tag = (e.target && e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (e.key === 'ArrowRight') goFn(index + 1, 1);
        else if (e.key === 'ArrowLeft') goFn(index - 1, -1);
      });

      // swipe — touch-action:pan-y on the section keeps vertical scroll native
      var sx = 0, sy = 0, down = false;
      hero.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        down = true; sx = e.clientX; sy = e.clientY;
      });
      window.addEventListener('pointerup', function (e) {
        if (!down) return;
        down = false;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        goFn(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      });
      hero.addEventListener('pointercancel', function () { down = false; });
    }

    /* ── simple mode: class-driven crossfade, no autoplay ─────────────── */
    if (SIMPLE) {
      hero.classList.add('hs--simple');
      setActive(0);
      bind(function (to) {
        index = (to + total) % total;
        setActive(index);
        if (curEl) curEl.textContent = pad(index);
      });
      return { intro: function () {} };
    }

    /* ── full mode ────────────────────────────────────────────────────── */
    var parts = slides.map(function (s) {
      var chars = [];
      $$('.hs__title [data-split="chars"]', s).forEach(function (el) {
        chars = chars.concat(splitChars(el) || [el]);
      });
      return {
        el: s,
        media: $('.hs__media', s),
        img: $('.hs__media img', s),
        chars: chars,
        copy: [$('.hs__eyebrow', s), $('.hs__lede', s)].concat($$('.hs__cta > *', s)).filter(Boolean),
        stat: $('.hs__stat', s)
      };
    });

    var D = 1.35, WIPE = 'expo.inOut';

    function hide(p) {
      gsap.set(p.el, { autoAlpha: 0, zIndex: 1 });
      gsap.set(p.media, { clipPath: 'inset(0% 0% 0% 0%)' });
      gsap.set(p.img, { xPercent: 0, scale: 1 });
    }

    function burn(p) {
      if (burns) burns.kill();
      burns = gsap.to(p.img, { scale: 1.1, duration: AUTOPLAY + 2.5, ease: 'none' });
    }

    function stopProgress() {
      if (progress) { progress.kill(); progress = null; }
      gsap.set($$('.hs__bar em', hero), { scaleX: 0 });
    }

    function syncPlay() {
      if (!progress) return;
      if (inView && !hovering && !hidden && !busy) progress.play(); else progress.pause();
    }

    function startProgress() {
      stopProgress();
      var bar = $('.hs__bar em', tabs[index]);
      if (!bar) return;
      progress = gsap.fromTo(bar, { scaleX: 0 }, {
        scaleX: 1, duration: AUTOPLAY, ease: 'none',
        onComplete: function () { go(index + 1, 1); }
      });
      syncPlay();
    }

    function go(to, dir) {
      if (busy) return;
      var next = (to + total) % total;
      if (next === index) return;
      dir = dir || (next > index ? 1 : -1);

      busy = true;
      stopProgress();
      if (burns) { burns.kill(); burns = null; }
      if (tl) tl.kill();

      var out = parts[index], inn = parts[next];
      // a slide still leaving from an interrupted run gets tidied away now
      if (lastOut && lastOut !== inn && lastOut !== out) hide(lastOut);
      lastOut = out;
      index = next;
      setActive(index);

      tl = gsap.timeline({
        defaults: { ease: EASE },
        onComplete: function () {
          hide(out);
          lastOut = null;
          burn(inn);
          startProgress();
        }
      });

      // outgoing copy lifts away through its masks
      tl.to(out.chars, { yPercent: -110, duration: 0.6, ease: 'power3.in', stagger: { each: 0.006, from: 'start' } }, 0)
        .to(out.copy, { autoAlpha: 0, y: -18, duration: 0.5, ease: 'power2.in', stagger: 0.035 }, 0);
      if (out.stat) tl.to(out.stat, { autoAlpha: 0, x: -14, duration: 0.5, ease: 'power2.in' }, 0);

      // counter flips in the direction of travel
      if (curEl) {
        tl.to(curEl, { yPercent: dir * -100, duration: 0.45, ease: 'power3.in' }, 0)
          .call(function () { curEl.textContent = pad(index); })
          .fromTo(curEl, { yPercent: dir * 100 }, { yPercent: 0, duration: 0.8, immediateRender: false }, 0.5);
      }

      // incoming image wipes across, parallaxing against the outgoing one
      var from = dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)';
      tl.set(out.el, { zIndex: 2 }, 0)
        .set(inn.el, { autoAlpha: 1, zIndex: 3 }, 0.1)
        .fromTo(inn.media, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0%)', duration: D, ease: WIPE }, 0.1)
        .fromTo(inn.img, { xPercent: dir * 18, scale: 1.2 }, { xPercent: 0, scale: 1, duration: D, ease: WIPE }, 0.1)
        .to(out.img, { xPercent: dir * -12, scale: '+=0.06', duration: D, ease: WIPE }, 0.1);

      if (edge) {
        tl.fromTo(edge, { left: dir > 0 ? '100%' : '0%', autoAlpha: 1 }, { left: dir > 0 ? '0%' : '100%', duration: D, ease: WIPE, immediateRender: false }, 0.1)
          .to(edge, { autoAlpha: 0, duration: 0.3 }, 0.1 + D - 0.12);
      }

      // once the wipe lands the slider may be driven again
      tl.call(function () { busy = false; }, null, 0.1 + D);

      // incoming copy rises in behind the seam
      var T = 0.72;
      tl.fromTo(inn.chars, { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: { each: 0.012, from: 'start' } }, T)
        .fromTo(inn.copy, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.07 }, T + 0.08);
      if (inn.stat) tl.fromTo(inn.stat, { autoAlpha: 0, x: 16 }, { autoAlpha: 1, x: 0, duration: 0.9 }, T + 0.35);
    }

    // hidden states now, so nothing shows through the lifting preloader
    parts.forEach(function (p, k) {
      gsap.set(p.el, { autoAlpha: k === 0 ? 1 : 0, zIndex: k === 0 ? 2 : 1 });
      gsap.set(p.media, { clipPath: 'inset(0% 0% 0% 0%)' });
    });
    var first = parts[0];
    gsap.set(first.chars, { yPercent: 115 });
    gsap.set(first.copy, { autoAlpha: 0, y: 20 });
    if (first.stat) gsap.set(first.stat, { autoAlpha: 0, x: 16 });
    gsap.set(first.img, { scale: 1.28, yPercent: 8 });
    gsap.set(['.hs__count', '.hs__ui'], { autoAlpha: 0, y: 12 });
    gsap.set('.hs__rule', { scaleX: 0, transformOrigin: 'left center' });
    setActive(0);
    busy = true;

    function intro() {
      var it = gsap.timeline({
        defaults: { ease: EASE },
        onComplete: function () {
          busy = false;
          burn(first);
          startProgress();
          scrollFx();
        }
      });
      it.to(first.img, { scale: 1, yPercent: 0, duration: 2.2, ease: 'expo.out' }, 0)
        .to(first.chars, { yPercent: 0, duration: 1.2, stagger: { each: 0.014, from: 'start' } }, 0.25)
        .to(first.copy, { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.07 }, 0.45)
        .to('.hs__rule', { scaleX: 1, duration: 1.3 }, 0.4);
      if (first.stat) it.to(first.stat, { autoAlpha: 1, x: 0, duration: 0.9 }, 0.75);
      it.to(['.hs__count', '.hs__ui'], { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.8);
    }

    // scroll: the composition sinks and fades as the page moves on
    function scrollFx() {
      if (!HAS_ST) return;
      gsap.to('.hs__track', {
        yPercent: 22, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
      gsap.to(['.hs__content', '.hs__ui', '.hs__count'], {
        opacity: 0, y: -50, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: '70% top', scrub: true }
      });
    }

    // autoplay only runs while the slider is actually being looked at
    if (HAS_ST) {
      ScrollTrigger.create({
        trigger: hero, start: 'top bottom', end: 'bottom top',
        onToggle: function (self) { inView = self.isActive; syncPlay(); }
      });
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting; syncPlay();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', function () {
      hidden = document.hidden; syncPlay();
    });
    if (ui) {
      ui.addEventListener('mouseenter', function () { hovering = true; syncPlay(); });
      ui.addEventListener('mouseleave', function () { hovering = false; syncPlay(); });
    }

    bind(go);
    return { intro: intro };
  }

  /* ═══════════════════════════════════════════════════ 08 · marquees ══ */
  var marqueeTweens = [];

  function initMarquees() {
    if (!HAS_GSAP) return;

    $$('[data-marquee]').forEach(function (mq) {
      var track = $('.marquee__track', mq);
      if (!track) return;

      // Triple the content, then travel exactly one third. Using xPercent
      // (a share of the track's OWN width) keeps the loop seamless through
      // any resize — no re-measuring, no seam.
      var original = Array.prototype.slice.call(track.children);
      for (var pass = 0; pass < 2; pass++) {
        original.forEach(function (n) {
          var c = n.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          track.appendChild(c);
        });
      }

      var speed = parseFloat(mq.getAttribute('data-speed')) || 0.5;
      var reverse = mq.hasAttribute('data-reverse');
      var oneSet = track.scrollWidth / 3;

      if (REDUCED) return;

      var tw = gsap.fromTo(track,
        { xPercent: reverse ? -100 / 3 : 0 },
        {
          xPercent: reverse ? 0 : -100 / 3,
          duration: Math.max(10, oneSet / (60 * speed)),
          ease: 'none',
          repeat: -1
        });
      marqueeTweens.push(tw);
    });

    // scroll velocity nudges the marquee speed — small, but it sells the craft
    if (HAS_ST && !REDUCED && marqueeTweens.length) {
      ScrollTrigger.create({
        start: 0, end: 'max',
        onUpdate: function (self) {
          var v = gsap.utils.clamp(-4, 4, self.getVelocity() / 320);
          marqueeTweens.forEach(function (t) {
            gsap.to(t, { timeScale: 1 + Math.abs(v) * 0.6, duration: 0.4, overwrite: true });
          });
        }
      });
    }
  }

  /* ═══════════════════════════════════════════════════ 09 · counters ══ */
  function initCounters() {
    if (!HAS_GSAP || !HAS_ST) return;

    $$('.num[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count'));
      var dur = parseFloat(el.getAttribute('data-dur')) || 1.8;
      if (isNaN(end)) return;

      if (REDUCED) { el.textContent = end; return; }

      // markup ships the final figure (for the no-JS case); JS owns the
      // zeroing so there is no flash of the answer before the count runs
      el.textContent = '0';

      var obj = { v: 0 };
      gsap.to(obj, {
        v: end,
        duration: dur,
        ease: 'power2.out',
        onUpdate: function () { el.textContent = Math.round(obj.v); },
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

  }

  /* ═════════════════════════════════════════════════════ 09b · stats bento ══ */
  function initStats() {
    var bento = $('[data-bento]');
    if (!bento) return;
    var cards = $$('[data-bx]', bento);

    // dot field: each dot a campus, a few glowing gold
    var field = $('[data-dots]', bento), dots = [];
    if (field) {
      var small = window.innerWidth < 600, dot = small ? 9 : 11, gap = small ? 8 : 9;
      var cols = Math.max(8, Math.floor((field.clientWidth + gap) / (dot + gap)));
      var rows = small ? 7 : 9;
      field.style.setProperty('--cols', cols);
      field.style.setProperty('--dot', dot + 'px');
      field.style.setProperty('--gap', gap + 'px');
      for (var d = 0; d < cols * rows; d++) {
        var i = document.createElement('i');
        var r = Math.random();
        if (r < 0.07) i.className = 'hot'; else if (r < 0.62) i.className = 'on';
        field.appendChild(i);
        dots.push(i);
      }
      if (!REDUCED) {
        setInterval(function () {
          var a = dots[Math.floor(Math.random() * dots.length)];
          var b = dots[Math.floor(Math.random() * dots.length)];
          if (a) a.className = 'hot';
          if (b && b !== a) b.className = Math.random() < 0.5 ? 'on' : '';
        }, 900);
      }
    }

    if (!TOUCH) {
      cards.forEach(function (c) {
        c.addEventListener('mousemove', function (e) {
          var rc = c.getBoundingClientRect();
          c.style.setProperty('--mx', (e.clientX - rc.left) + 'px');
          c.style.setProperty('--my', (e.clientY - rc.top) + 'px');
        });
      });
    }

    var ready = function () { cards.forEach(function (c) { c.classList.add('is-ready'); }); };
    if (!HAS_GSAP || !HAS_ST || REDUCED) { ready(); return; }

    var st = { trigger: bento, start: 'top 82%', once: true };

    gsap.from(cards, {
      y: 70, autoAlpha: 0, scale: 0.96, duration: 1.15, ease: EASE, stagger: 0.09,
      scrollTrigger: st,
      onComplete: function () { gsap.set(cards, { clearProps: 'transform' }); ready(); }
    });

    if (dots.length) {
      gsap.from(dots, {
        scale: 0, autoAlpha: 0, duration: 0.6, ease: 'back.out(2)',
        stagger: { each: 0.0045, from: 'random' }, delay: 0.3,
        scrollTrigger: st
      });
    }

    gsap.from($$('.bx__ticks i', bento), {
      scaleY: 0, duration: 0.9, ease: EASE, stagger: 0.035, delay: 0.45,
      scrollTrigger: st
    });

    gsap.from($$('.bx__faces i', bento), {
      x: -24, autoAlpha: 0, duration: 0.8, ease: EASE, stagger: 0.08, delay: 0.6,
      scrollTrigger: st
    });

    var years = $('.bx--years', bento);
    if (years) {
      var yst = { trigger: years, start: 'top 88%', once: true };
      gsap.from($('.bx__rail span', years), { scaleX: 0, duration: 1.8, ease: 'expo.inOut', delay: 0.3, scrollTrigger: yst });
      gsap.from($$('.bx__pt', years), { autoAlpha: 0, y: 12, duration: 0.8, ease: EASE, stagger: 1.2, delay: 0.35, scrollTrigger: yst });
    }

    var img = $('.bx--learners img', bento);
    if (img) {
      gsap.fromTo(img, { yPercent: -6, scale: 1.12 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 }
      });
    }
  }

  /* ══════════════════════════════════════════ 10 · generic reveals ══ */
  function initReveals() {
    if (!HAS_GSAP) return;

    $$('[data-split="lines"]').forEach(function (el) { revealLines(el); });

    $$('[data-fade]').forEach(function (el) {
      if (el.closest('.hero')) return;              // hero handled by its own timeline
      if (REDUCED || !HAS_ST) return;
      gsap.from(el, {
        autoAlpha: 0, y: 16, duration: 0.9, ease: EASE,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });

    // section images drift
    if (!HAS_ST || REDUCED) return;
    $$('[data-parallax-in] img').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 }
      });
    });
    $$('.cta__bg img[data-parallax]').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -8 }, {
        yPercent: 8, ease: 'none',
        scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: 1 }
      });
    });
  }

  /* ══════════════════════════════ 11 · legacy horizontal timeline ══ */
  function initTimeline() {
    var wrap = $('[data-timeline]');
    if (!wrap || !HAS_GSAP || !HAS_ST) return;

    var track = $('.tl__track', wrap);
    var view  = $('.tl__viewport', wrap);
    var bar   = $('[data-tl-bar]', wrap);
    if (!track || !view) return;

    // below the pin breakpoint, let it scroll horizontally by touch instead
    var mm = gsap.matchMedia();

    mm.add('(min-width: 861px)', function () {
      if (REDUCED) return;

      var getDistance = function () {
        return Math.max(0, track.scrollWidth - view.clientWidth);
      };

      var tween = gsap.to(track, {
        x: function () { return -getDistance(); },
        ease: 'none',
        scrollTrigger: {
          trigger: wrap,
          pin: true,
          scrub: 1,
          start: 'top top',
          end: function () { return '+=' + (getDistance() * 1.15); },
          invalidateOnRefresh: true,
          anticipatePin: 1,
          // This pin injects ~2000px of extra scroll distance. Every trigger
          // further down the page must be measured AFTER the spacer exists,
          // so this one has to refresh first — otherwise they all fire early
          // by exactly the pinned distance.
          refreshPriority: 10,
          onUpdate: function (self) {
            if (bar) gsap.set(bar, { width: (self.progress * 100).toFixed(2) + '%' });
          }
        }
      });

      // cards lean in as they enter the viewport horizontally
      $$('.tl__card', track).forEach(function (card) {
        gsap.from(card, {
          y: 46, autoAlpha: 0, duration: 1, ease: EASE,
          scrollTrigger: {
            trigger: card,
            containerAnimation: tween,
            start: 'left 92%',
            once: true
          }
        });
      });

      return function () { tween.scrollTrigger && tween.scrollTrigger.kill(); tween.kill(); };
    });

    mm.add('(max-width: 860px)', function () {
      // native horizontal scroll on small screens
      view.style.overflowX = 'auto';
      view.style.scrollSnapType = 'x mandatory';
      view.style.webkitOverflowScrolling = 'touch';
      $$('.tl__card', track).forEach(function (c) { c.style.scrollSnapAlign = 'center'; });

      var onScroll = function () {
        if (!bar) return;
        var max = track.scrollWidth - view.clientWidth;
        bar.style.width = max > 0 ? ((view.scrollLeft / max) * 100).toFixed(2) + '%' : '0%';
      };
      view.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      return function () { view.removeEventListener('scroll', onScroll); view.style.overflowX = ''; };
    });
  }

  /* ═══════════════════════════════════════ 12 · programme stack ══ */
  function initProgrammes() {
    var cards = $$('[data-pcard]');
    if (!cards.length || !HAS_GSAP || !HAS_ST || REDUCED) return;

    var mm = gsap.matchMedia();
    mm.add('(min-width: 861px)', function () {
      cards.forEach(function (card, i) {
        var inner = $('.pcard__in', card);
        var img   = $('.pcard__img img', card);

        // image slow-pans inside its frame
        if (img) {
          gsap.fromTo(img, { yPercent: -5, scale: 1.1 }, {
            yPercent: 5, ease: 'none',
            scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 1 }
          });
        }

        // entering card rises
        gsap.from(inner, {
          y: 60, autoAlpha: 0, duration: 1, ease: EASE,
          scrollTrigger: { trigger: card, start: 'top 88%', once: true }
        });

        // outgoing card recedes as the next one covers it
        if (i < cards.length - 1) {
          gsap.to(inner, {
            scale: 0.93,
            autoAlpha: 0.35,
            ease: 'none',
            scrollTrigger: {
              trigger: cards[i + 1],
              start: 'top bottom',
              end: 'top 30%',
              scrub: true
            }
          });
        }
      });
    });
  }

  /* ═══════════════════════════════════════════ 13 · the edge list ══ */
  function initEdge() {
    var items = $$('.edge__item');
    var imgs  = $$('[data-edge-img]');
    var nEl   = $('[data-edge-n]');
    if (!items.length || !HAS_ST) return;

    var setActive = function (i) {
      items.forEach(function (it, k) { it.classList.toggle('is-on', k === i); });
      imgs.forEach(function (im, k) { im.classList.toggle('is-on', k === i); });
      if (nEl) nEl.textContent = String(i + 1).padStart(2, '0');
    };

    items.forEach(function (item, i) {
      ScrollTrigger.create({
        trigger: item,
        start: 'top 62%',
        end: 'bottom 62%',
        onEnter: function () { setActive(i); },
        onEnterBack: function () { setActive(i); }
      });

      // NB: deliberately no opacity here. These items carry a CSS opacity
      // (.42 dimmed / 1 when .is-on) and an inline opacity from GSAP would
      // outrank the class and freeze every item at the dimmed value.
      if (REDUCED || !HAS_GSAP) return;
      gsap.from(item, {
        y: 30, duration: 0.9, ease: EASE,
        scrollTrigger: { trigger: item, start: 'top 92%', once: true }
      });
    });

    setActive(0);
  }

  /* ═══════════════════════════════════════════════ 14 · digital ══ */
  function initDigital() {
    if (!HAS_GSAP || !HAS_ST) return;

    if (!REDUCED) {
      $$('.dig').forEach(function (card, i) {
        gsap.from(card, {
          y: 44, autoAlpha: 0, duration: 1, ease: EASE, delay: (i % 3) * 0.07,
          scrollTrigger: { trigger: card, start: 'top 88%', once: true }
        });
      });

      var bars = $$('.dig__ui-bars i');
      if (bars.length) {
        gsap.from(bars, {
          scaleY: 0, transformOrigin: 'bottom', duration: 0.9, ease: EASE, stagger: 0.05,
          scrollTrigger: { trigger: '.dig__ui-bars', start: 'top 92%', once: true }
        });
      }
    }

    // subtle pointer tilt
    if (TOUCH || REDUCED) return;
    $$('[data-tilt]').forEach(function (el) {
      var rxTo = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' });
      var ryTo = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' });
      gsap.set(el, { transformPerspective: 900, transformStyle: 'preserve-3d' });

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        ryTo(((e.clientX - (r.left + r.width / 2)) / r.width) * 6);
        rxTo(-((e.clientY - (r.top + r.height / 2)) / r.height) * 6);
      });
      el.addEventListener('mouseleave', function () { rxTo(0); ryTo(0); });
    });
  }

  /* ═════════════════════════════════════ 15 · founder word-highlight ══ */
  function initHighlight() {
    var el = $('[data-highlight]');
    if (!el || !HAS_GSAP || !HAS_ST) return;

    if (REDUCED) { el.style.color = '#fff'; return; }

    var words;
    if (HAS_SPLIT) {
      words = new SplitText(el, { type: 'words', wordsClass: 'w' }).words;
    } else {
      // manual fallback so the effect still runs without the plugin
      var walk = function (node) {
        if (node.nodeType === 3) {
          var frag = document.createDocumentFragment();
          node.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t.trim()) { frag.appendChild(document.createTextNode(t)); return; }
            var s = document.createElement('span');
            s.className = 'w'; s.textContent = t;
            frag.appendChild(s);
          });
          node.parentNode.replaceChild(frag, node);
        } else if (node.nodeType === 1) {
          Array.prototype.slice.call(node.childNodes).forEach(walk);
        }
      };
      walk(el);
      words = $$('.w', el);
    }
    if (!words || !words.length) return;

    // words inside <mark> resolve gold, everything else white
    gsap.to(words, {
      color: function (i, target) {
        return target.closest('mark') ? '#E4A33A' : '#FFFFFF';
      },
      ease: 'none',
      stagger: 0.6,
      scrollTrigger: {
        trigger: el,
        start: 'top 78%',
        end: 'bottom 62%',
        scrub: 0.6
      }
    });

    gsap.from('.voices__sig', {
      autoAlpha: 0, y: 22, duration: 1, ease: EASE,
      scrollTrigger: { trigger: '.voices__sig', start: 'top 92%', once: true }
    });
    gsap.from('.voices__line', {
      scaleX: 0, transformOrigin: 'left', duration: 1.1, ease: EASE,
      scrollTrigger: { trigger: '.voices__sig', start: 'top 92%', once: true }
    });
  }

  /* ══════════════════════════════════════════════════ 16 · locator ══ */
  function initLocator() {
    var map = $('[data-map]');
    if (!map || !HAS_GSAP || !HAS_ST || REDUCED) return;

    var pins = $$('.pin', map);
    gsap.from(pins, {
      autoAlpha: 0, scale: 0.4, duration: 0.7, ease: 'back.out(2)',
      stagger: { each: 0.07, from: 'random' },
      scrollTrigger: { trigger: map, start: 'top 82%', once: true }
    });

    // network wires draw themselves in — pathLength="1" on the <g> normalises
    // every line so one dasharray value works for all of them
    var wires = $$('.loc__web line', map);
    if (wires.length) {
      gsap.fromTo(wires,
        { strokeDasharray: 1, strokeDashoffset: 1 },
        {
          strokeDashoffset: 0, duration: 1.1, ease: 'power2.out',
          stagger: { each: 0.07, from: 'start' },
          scrollTrigger: { trigger: map, start: 'top 82%', once: true }
        });
    }

    gsap.from('.finder', {
      autoAlpha: 0, y: 30, duration: 1, ease: EASE,
      scrollTrigger: { trigger: '.finder', start: 'top 88%', once: true }
    });
  }

  /* ═════════════════════════════════════════════ 17 · cta + footer ══ */
  function initOutro() {
    if (!HAS_GSAP || !HAS_ST || REDUCED) return;

    // CTA headline, character reveal on scroll
    $$('.cta__ttl [data-split="chars"]').forEach(function (el, i) {
      var chars = splitChars(el);
      var target = chars || el;
      gsap.from(target, {
        yPercent: 115,
        duration: 1.1,
        ease: EASE,
        stagger: chars ? 0.018 : 0,
        scrollTrigger: { trigger: '.cta__ttl', start: 'top 82%', once: true }
      });
    });

    gsap.from('.cta__acts > *', {
      autoAlpha: 0, y: 24, duration: 0.9, ease: EASE, stagger: 0.09,
      scrollTrigger: { trigger: '.cta__acts', start: 'top 92%', once: true }
    });
    gsap.from('.cta__meta div', {
      autoAlpha: 0, y: 22, duration: 0.9, ease: EASE, stagger: 0.09,
      scrollTrigger: { trigger: '.cta__meta', start: 'top 94%', once: true }
    });

    // footer wordmark scales up from the fold
    var word = $('[data-foot-word]');
    if (word) {
      gsap.fromTo(word,
        { yPercent: 32, scaleX: 1.06 },
        {
          yPercent: 0, scaleX: 1, ease: 'none',
          scrollTrigger: { trigger: '.foot__word', start: 'top bottom', end: 'bottom bottom', scrub: 1 }
        });
    }

    gsap.from('.foot__cols div', {
      autoAlpha: 0, y: 24, duration: 0.8, ease: EASE, stagger: 0.07,
      scrollTrigger: { trigger: '.foot__top', start: 'top 88%', once: true }
    });
  }

  /* ═════════════════════════════════════════ 18 · topper marquee hover ══ */
  function initToppers() {
    if (!HAS_GSAP || TOUCH) return;
    var mq = $('.marquee--cards');
    if (!mq) return;
    // pause the belt while a card is being read
    mq.addEventListener('mouseenter', function () {
      marqueeTweens.forEach(function (t) { if (mq.contains(t.targets()[0])) gsap.to(t, { timeScale: 0.15, duration: 0.5 }); });
    });
    mq.addEventListener('mouseleave', function () {
      marqueeTweens.forEach(function (t) { if (mq.contains(t.targets()[0])) gsap.to(t, { timeScale: 1, duration: 0.6 }); });
    });
  }

  /* ═══════════════════════════════════════════════════════ 19 · boot ══ */
  function build() {
    // ORDER MATTERS. ScrollTrigger refreshes same-priority triggers in the
    // order they were created, so anything that pins (and therefore changes
    // document height) is built first — see refreshPriority in initTimeline.
    initTimeline();

    initNav();
    initMagnetic();
    initMarquees();
    initCounters();
    initStats();
    initReveals();
    initProgrammes();
    initEdge();
    initDigital();
    initHighlight();
    initLocator();
    initOutro();
    initToppers();

    if (!HAS_ST) return;

    var refresh = function () { ScrollTrigger.refresh(); };

    // re-measure once webfonts have settled — line splits depend on it
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);

    // `load` may already have fired by the time the preloader hands over
    if (document.readyState === 'complete') requestAnimationFrame(refresh);
    else window.addEventListener('load', refresh);

    // late-loading images can still shift things
    window.addEventListener('resize', refresh);
  }

  function start() {
    var nav = $('#nav');
    if (nav && $('.hs')) nav.classList.add('is-light');

    initLenis();
    var hero = initHeroSlider();
    initLoader(function () {
      if (hero) hero.intro();
    }, build);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
