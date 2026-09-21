/* ─────────────────────────────────────────────
   Mark Pais — interactions. No dependencies.
   ───────────────────────────────────────────── */

(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  if (!reduced) root.classList.add("js");

  /* ── shared render loop ────────────────────────────────────── */

  var frameTasks = [];
  function onFrame(fn) { frameTasks.push(fn); }
  (function tick() {
    for (var i = 0; i < frameTasks.length; i++) frameTasks[i]();
    requestAnimationFrame(tick);
  })();

  /* ── smooth scroll (desktop pointer only) ──────────────────── */

  var smooth = null;

  if (fine && !reduced) {
    smooth = {
      target: window.scrollY,
      current: window.scrollY,
      velocity: 0,
      running: false,
      lock: false
    };

    var maxScroll = function () {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    };

    window.addEventListener("wheel", function (e) {
      if (smooth.lock || e.ctrlKey) return;
      e.preventDefault();
      var delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= window.innerHeight;
      smooth.target = clamp(smooth.target + delta, 0, maxScroll());
      smooth.running = true;
    }, { passive: false });

    // keyboard / scrollbar / anything native: resync so we never fight the browser
    window.addEventListener("scroll", function () {
      if (!smooth.running) {
        smooth.target = window.scrollY;
        smooth.current = window.scrollY;
      }
    }, { passive: true });

    window.addEventListener("resize", function () {
      smooth.target = clamp(smooth.target, 0, maxScroll());
    });

    onFrame(function () {
      if (!smooth.running) { smooth.velocity *= 0.9; return; }
      var next = smooth.current + (smooth.target - smooth.current) * 0.12;
      smooth.velocity = next - smooth.current;
      smooth.current = next;
      if (Math.abs(smooth.target - smooth.current) < 0.35) {
        smooth.current = smooth.target;
        smooth.running = false;
      }
      window.scrollTo(0, smooth.current);
    });
  }

  function scrollToY(y) {
    y = clamp(y, 0, Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
    if (smooth) {
      smooth.target = y;
      smooth.running = true;
    } else {
      window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
    }
  }

  function scrollVelocity() { return smooth ? smooth.velocity : 0; }

  /* ── split headings into masked words ──────────────────────── */

  function splitWords(node) {
    var kids = Array.prototype.slice.call(node.childNodes);
    kids.forEach(function (child) {
      if (child.nodeType === 3) {
        if (!child.textContent.trim()) return;
        var frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function (chunk) {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) { frag.appendChild(document.createTextNode(" ")); return; }
          var mask = document.createElement("span");
          mask.className = "split__mask";
          var word = document.createElement("span");
          word.className = "split__word";
          word.textContent = chunk;
          mask.appendChild(word);
          frag.appendChild(mask);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) {
        splitWords(child);
      }
    });
  }

  if (!reduced) {
    document.querySelectorAll("[data-split]").forEach(function (el) {
      splitWords(el);
      el.querySelectorAll(".split__word").forEach(function (w, i) {
        w.style.transitionDelay = Math.min(i * 0.035, 0.7) + "s";
      });
    });

    document.querySelectorAll("[data-stagger]").forEach(function (list) {
      Array.prototype.forEach.call(list.children, function (child, i) {
        child.style.transitionDelay = Math.min(i * 0.07, 0.6) + "s";
      });
    });
  }

  /* ── reveal on scroll ──────────────────────────────────────── */

  if (!reduced && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

    document.querySelectorAll("[data-split], [data-reveal], [data-stagger]").forEach(function (el) {
      if (el.closest(".hero")) return; // hero plays on load, behind the loader
      io.observe(el);
    });
  }

  // hero: reveal once the loader curtain lifts
  var heroDelay = reduced ? 0 : 1500;
  setTimeout(function () {
    document.querySelectorAll(".hero [data-split], .hero [data-reveal]").forEach(function (el) {
      el.classList.add("is-in");
    });
  }, heroDelay);

  /* ── horizontal pinned section ─────────────────────────────── */

  var pin = document.querySelector("[data-pin]");
  var track = document.querySelector("[data-track]");
  var things = document.querySelector(".things");
  var pinned = false;
  var travel = 0;
  var eased = 0;

  function layoutPin() {
    if (!pin || !track || !things) return;
    var wide = window.matchMedia("(min-width: 900px)").matches && !reduced;

    if (!wide) {
      pinned = false;
      things.style.height = "";
      track.style.transform = "";
      pin.classList.remove("is-pinned");
      document.querySelectorAll("[data-card]").forEach(function (c) { c.classList.add("is-in"); });
      return;
    }

    pinned = true;
    pin.classList.add("is-pinned");
    track.style.transform = "translate3d(0,0,0)";
    travel = Math.max(0, track.scrollWidth - window.innerWidth);
    // extra viewport height so the last card gets a beat before the section releases
    things.style.height = (window.innerHeight + travel + window.innerHeight * 0.35) + "px";
    eased = 0;
  }

  var rail = document.querySelector("[data-rail]");

  function updatePin() {
    if (!pinned || !pin || !track) return;
    var rect = things.getBoundingClientRect();
    var total = things.offsetHeight - window.innerHeight;
    var progress = clamp(-rect.top / total, 0, 1);
    var x = -progress * travel;
    if (rail) rail.style.transform = "scaleX(" + progress.toFixed(4) + ")";
    eased += (x - eased) * 0.14;
    if (Math.abs(x - eased) < 0.2) eased = x;
    track.style.transform = "translate3d(" + eased.toFixed(2) + "px,0,0)";

    // reveal cards as they enter the viewport horizontally
    document.querySelectorAll("[data-card]").forEach(function (card) {
      if (card.classList.contains("is-in")) return;
      if (card.getBoundingClientRect().left < window.innerWidth * 0.92) card.classList.add("is-in");
    });
  }

  layoutPin();
  onFrame(updatePin);

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutPin, 150);
  });

  if (!window.matchMedia("(min-width: 900px)").matches || reduced) {
    document.querySelectorAll("[data-card]").forEach(function (c) { c.classList.add("is-in"); });
  }

  /* ── hero parallax, marquee velocity, progress, nav hiding ─── */

  var heroName = document.querySelector(".hero__name");
  var marquee = document.querySelector(".marquee__track");
  var progressBar = document.querySelector("[data-progress-bar]");
  var lastDir = 1;
  var lastY = window.scrollY;

  if (!reduced) {
    onFrame(function () {
      var y = window.scrollY;
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

      if (progressBar) {
        progressBar.style.transform = "scaleX(" + (y / max).toFixed(4) + ")";
      }

      if (Math.abs(y - lastY) > 4) {
        var down = y > lastY;
        document.body.classList.toggle("nav-hidden", down && y > window.innerHeight * 0.6);
        lastY = y;
      }

      if (heroName && y < window.innerHeight * 1.2) {
        var p = clamp(y / window.innerHeight, 0, 1);
        heroName.style.transform = "translate3d(0," + (-p * 14) + "%,0)";
        heroName.style.opacity = String(1 - p * 0.72);
      }

      if (marquee) {
        var v = scrollVelocity();
        var dir = v < -0.4 ? -1 : v > 0.4 ? 1 : lastDir;
        if (dir !== lastDir) {
          marquee.style.animationDirection = dir === 1 ? "normal" : "reverse";
          lastDir = dir;
        }
        var boost = clamp(Math.abs(v) / 26, 0, 2.6);
        marquee.style.animationDuration = (34 / (1 + boost)).toFixed(2) + "s";
      }
    });
  }

  /* ── menu ──────────────────────────────────────────────────── */

  var menuBtn = document.querySelector(".menu-btn");
  var menu = document.getElementById("menu");

  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    if (menuBtn) menuBtn.setAttribute("aria-expanded", String(open));
    if (menu) menu.setAttribute("aria-hidden", String(!open));
    if (smooth) smooth.lock = open;
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-open"));
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });

  /* ── anchor links ──────────────────────────────────────────── */

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href");
      if (!id || id === "#") return;
      var target = id === "#top" ? document.body : document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var wasOpen = document.body.classList.contains("menu-open");
      setMenu(false);
      var go = function () {
        var y = id === "#top" ? 0 : target.getBoundingClientRect().top + window.scrollY;
        scrollToY(y);
      };
      wasOpen ? setTimeout(go, 420) : go();
    });
  });

  /* ── custom cursor ─────────────────────────────────────────── */

  if (fine && !reduced) {
    var dot = document.querySelector(".cursor");
    var ring = document.querySelector(".cursor-ring");
    var label = document.querySelector(".cursor__label");
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my, scale = 1, scaleTarget = 1;

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.opacity = "1";
      ring.style.opacity = "1";
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0) translate(-50%,-50%)";
    }, { passive: true });

    document.addEventListener("mouseleave", function () {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    });

    onFrame(function () {
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;
      scale += (scaleTarget - scale) * 0.15;
      ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0) translate(-50%,-50%) scale(" + scale.toFixed(3) + ")";
    });

    document.querySelectorAll("a, button, [data-card], .facts li, .now__list li").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        var text = el.getAttribute("data-cursor");
        if (text) {
          label.textContent = text;
          dot.classList.add("is-active");
          scaleTarget = 0.4;
        } else {
          scaleTarget = 1.7;
        }
      });
      el.addEventListener("mouseleave", function () {
        dot.classList.remove("is-active");
        label.textContent = "";
        scaleTarget = 1;
      });
    });
  }

  /* ── magnetic elements ─────────────────────────────────────── */

  if (fine && !reduced) {
    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * 0.28;
        var y = (e.clientY - (r.top + r.height / 2)) * 0.34;
        el.style.transition = "transform 0.12s ease-out";
        el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transition = "transform 0.6s cubic-bezier(0.22,1,0.36,1)";
        el.style.transform = "translate(0,0)";
      });
    });
  }

  /* ── odds and ends ─────────────────────────────────────────── */

  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  var clockEl = document.querySelector("[data-clock]");
  function tickClock() {
    if (!clockEl) return;
    try {
      clockEl.textContent = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Detroit", hour: "2-digit", minute: "2-digit", hour12: false
      }).format(new Date()) + " local";
    } catch (e) { clockEl.textContent = ""; }
  }
  tickClock();
  setInterval(tickClock, 20000);

  window.addEventListener("load", function () { setTimeout(layoutPin, 60); });
})();
