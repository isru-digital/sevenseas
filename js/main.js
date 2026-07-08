/* ============================================================
   SEVEN SEAS - concept demo by ISRU (Itzik Uziel).
   Scroll-scrub engine (scroll-cinematic-site skill) + count-up
   stats + 3D tilt cards. Vanilla JS, no dependencies.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mqMobile = window.matchMedia("(max-width: 820px), (orientation: portrait)");

  var film   = document.getElementById("film");
  var video  = document.getElementById("filmVideo");
  var caps   = Array.prototype.slice.call(document.querySelectorAll(".cap"));
  var dots   = Array.prototype.slice.call(document.querySelectorAll(".dots a"));
  var cue    = document.getElementById("scrollCue");
  var nav    = document.getElementById("nav");
  var pbar   = document.getElementById("progress");
  var loader = document.getElementById("loader");

  /* per-clip durations (seconds) - MUST match the real film; verified with ffprobe */
  var DUR = [8.041667, 5.041667, 5.041667, 6.041667, 6.041667, 6.041667, 5.041667];
  var TOTAL = DUR.reduce(function (a, b) { return a + b; }, 0);
  var bands = (function () {
    var out = [], acc = 0;
    DUR.forEach(function (d) { var from = acc / TOTAL; acc += d; out.push({ from: from, to: acc / TOTAL }); });
    return out;
  })();

  /* ---------- preloader ---------- */
  var loaderGone = false;
  function hideLoader() {
    if (loaderGone || !loader) return;
    loaderGone = true;
    loader.classList.add("is-hidden");
    loader.setAttribute("aria-hidden", "true");
  }
  setTimeout(hideLoader, 2800);

  /* ---------- film source (PC vs mobile) + priming ---------- */
  var ready = false, primed = false;
  function wantSrc() { return mqMobile.matches ? video.dataset.srcM : video.dataset.src; }
  function loadFilm() {
    var want = wantSrc();
    if (video.getAttribute("src") !== want) {
      video.setAttribute("src", want);
      video.load();
      ready = false; primed = false;
    }
  }
  video.addEventListener("loadedmetadata", function () { ready = true; update(); });
  video.addEventListener("loadeddata", hideLoader);
  video.addEventListener("canplay", hideLoader);
  function prime() {
    if (primed) return;
    primed = true;
    var p = video.play();
    if (p && p.then) p.then(function () { video.pause(); }).catch(function () { primed = false; });
    else { try { video.pause(); } catch (e) {} }
  }

  /* ---------- scrub engine ---------- */
  function dur() { return (video.duration && isFinite(video.duration)) ? video.duration : TOTAL; }

  function filmProgress() {
    var scrollable = film.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    var top = film.getBoundingClientRect().top;
    var p = -top / scrollable;
    return p < 0 ? 0 : (p > 1 ? 1 : p);
  }
  function activeIndex(p) {
    for (var i = 0; i < bands.length; i++) { if (p < bands[i].to) return i; }
    return bands.length - 1;
  }
  var lastP = 0;
  function bufferedEnd() {
    try { return video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0; } catch (e) { return 0; }
  }
  function seek(t) {
    if (!ready) return;
    var safe = Math.min(t, Math.max(0, bufferedEnd() - 0.05));
    try { video.currentTime = safe; } catch (e) {}
  }

  var lerpOn = !prefersReduced && typeof window.requestAnimationFrame === "function";
  var targetT = 0, currentT = 0, rafId = null;
  function tick() {
    var diff = targetT - currentT;
    if (Math.abs(diff) < 0.008) {
      currentT = targetT;
      seek(currentT);
      rafId = null;
      return;
    }
    currentT += diff * 0.22;
    seek(currentT);
    rafId = window.requestAnimationFrame(tick);
  }
  function requestSeek(t) {
    if (!lerpOn) { seek(t); return; }
    targetT = t;
    if (rafId === null) rafId = window.requestAnimationFrame(tick);
  }

  /* ---------- reveals + count-up ---------- */
  var revealEls = [];
  function runReveals() {
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    for (var k = 0; k < revealEls.length; k++) {
      if (!revealEls[k].classList.contains("is-in") &&
          revealEls[k].getBoundingClientRect().top < vh * 0.92) {
        revealEls[k].classList.add("is-in");
      }
    }
    runCounts(vh);
  }

  /* count-up: numbers animate once when scrolled into view (respects reduced motion) */
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
  function fmt(n) { return n.toLocaleString("he-IL"); }
  function runCounts(vh) {
    for (var i = counters.length - 1; i >= 0; i--) {
      var el = counters[i];
      if (el.getBoundingClientRect().top < vh * 0.92) {
        counters.splice(i, 1);
        startCount(el);
      }
    }
  }
  function startCount(el) {
    var end = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (prefersReduced) { el.textContent = fmt(end); return; }
    var t0 = null, D = 1400;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / D, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(end * eased));
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  /* ---------- 3D tilt cards (pointer only, never on touch / reduced motion) ---------- */
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  if (finePointer && !prefersReduced) {
    Array.prototype.forEach.call(document.querySelectorAll(".tilt"), function (card) {
      var raf = null;
      function onMove(e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        if (raf) return;
        raf = window.requestAnimationFrame(function () {
          card.style.transform = "rotateY(" + (x * 7) + "deg) rotateX(" + (y * -7) + "deg) translateY(-4px)";
          raf = null;
        });
      }
      function onLeave() {
        if (raf) { window.cancelAnimationFrame(raf); raf = null; }
        card.style.transform = "";
      }
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
    });
  }

  function update() {
    var p = filmProgress();
    lastP = p;
    var idx = activeIndex(p);
    for (var i = 0; i < caps.length; i++) caps[i].classList.toggle("is-active", i === idx);
    for (var j = 0; j < dots.length; j++) dots[j].classList.toggle("is-active", j === idx);
    if (cue) cue.style.opacity = p > 0.02 ? "0" : "";
    requestSeek(p * dur());
  }

  /* ---------- scroll handler ---------- */
  function onScroll() {
    update();
    var st = window.scrollY || window.pageYOffset;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (pbar) pbar.style.transform = "scaleX(" + (h > 0 ? st / h : 0) + ")";
    if (nav) nav.classList.toggle("is-scrolled", st > 40);
    runReveals();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", update, { passive: true });

  /* ---------- init ---------- */
  loadFilm();
  prime();
  revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal-item"));
  if (!prefersReduced) document.documentElement.classList.add("reveal-on");
  video.addEventListener("progress", function () { requestSeek(lastP * dur()); });
  ["touchstart", "pointerdown", "click", "keydown"].forEach(function (ev) {
    window.addEventListener(ev, prime, { once: true, passive: true });
  });
  onScroll();

  function onMQ() { loadFilm(); prime(); update(); }
  if (mqMobile.addEventListener) mqMobile.addEventListener("change", onMQ);
  else if (mqMobile.addListener) mqMobile.addListener(onMQ);

  /* dots → jump to a scene */
  function scrollToBand(i) {
    var scrollable = film.offsetHeight - window.innerHeight;
    var mid = (bands[i].from + bands[i].to) / 2;
    window.scrollTo({ top: Math.round(film.offsetTop + mid * scrollable), behavior: "smooth" });
  }
  dots.forEach(function (d, i) {
    d.addEventListener("click", function (e) { e.preventDefault(); scrollToBand(i); });
  });
  if (cue) cue.addEventListener("click", function (e) { e.preventDefault(); scrollToBand(1); });

  /* ---------- mobile menu ---------- */
  var toggle = document.getElementById("navToggle");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }
  document.querySelectorAll("[data-link]").forEach(function (a) {
    a.addEventListener("click", function () { if (nav) nav.classList.remove("is-open"); });
  });

  /* ---------- lead form (demo only - never actually sends) ---------- */
  var leadForm = document.getElementById("leadForm");
  var leadNote = document.getElementById("leadFormNote");
  if (leadForm && leadNote) {
    leadForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = leadForm.querySelector("#lf-name");
      if (!leadForm.checkValidity()) {
        var firstInvalid = leadForm.querySelector(":invalid");
        if (firstInvalid) firstInvalid.focus();
        return;
      }
      leadNote.hidden = false;
      leadNote.textContent =
        "תודה" + (name && name.value ? " " + name.value.trim().split(" ")[0] : "") +
        "! זו גרסת דמו, ולכן הפרטים לא נשלחים. באתר אמיתי הפנייה תגיע ישירות ל-CRM / למייל של המשרד.";
      leadForm.querySelectorAll("input, textarea").forEach(function (el) { el.value = ""; });
      leadNote.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
})();
