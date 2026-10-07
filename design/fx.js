(function () {
  if (window.__fx) return; window.__fx = 1;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.76,0,.24,1)', OUT = 'cubic-bezier(.2,.8,.2,1)';
  var css = [
    '*{scrollbar-width:thin;scrollbar-color:var(--color-neutral-400) transparent}',
    '.btn,button{transition:transform .18s ' + OUT + ',box-shadow .25s,background-color .2s,color .2s,opacity .2s}',
    '.btn:active,button:active{transform:scale(.97)}',
    '.btn-primary:hover{box-shadow:var(--shadow-md)}',
    'nav a{transition:padding-left .25s ' + OUT + ',box-shadow .25s}',
    'nav a:hover{padding-left:28px!important;box-shadow:inset 4px 0 0 var(--color-accent)}',
    '[style*="cursor:pointer"]{transition:filter .2s,background-color .2s,transform .2s}',
    '[style*="cursor:pointer"]:hover{filter:brightness(.95)}',
    '[style*="cursor:pointer"]:active{transform:scale(.995)}',
    '.input{transition:box-shadow .2s,border-color .2s}',
    '.input:focus{box-shadow:0 0 0 4px color-mix(in srgb,var(--color-accent) 22%,transparent)}',
    'a{transition:color .2s}',
    'html{scroll-behavior:smooth}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  if (reduce) return;

  function slab(from, to, dur, done) {
    var s = document.createElement('div');
    s.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#201e1d;pointer-events:none;border-right:12px solid #ec3013;box-sizing:border-box';
    document.body.appendChild(s);
    var a = s.animate([{ transform: 'translateX(' + from + ')' }, { transform: 'translateX(' + to + ')' }], { duration: dur, easing: EASE, fill: 'forwards' });
    a.onfinish = function () { done ? done() : s.remove(); };
    return s;
  }

  // page-enter wipe
  try {
    if (sessionStorage.getItem('fx-wipe')) {
      sessionStorage.removeItem('fx-wipe');
      var s = document.createElement('div');
      s.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#201e1d;pointer-events:none;border-right:12px solid #ec3013;box-sizing:border-box';
      document.body.appendChild(s);
      s.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(101%)' }], { duration: 560, delay: 60, easing: EASE, fill: 'forwards' }).onfinish = function () { s.remove(); };
    }
  } catch (e) {}

  // page-leave wipe
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    var h = a.getAttribute('href') || '';
    if (!/\.dc\.html(#.*)?$/.test(h) || h.indexOf('#') === 0) return;
    var path = h.split('#')[0];
    if (path === location.pathname.split('/').pop()) return;
    e.preventDefault();
    try { sessionStorage.setItem('fx-wipe', '1'); } catch (er) {}
    slab('-101%', '0%', 420, function () { location.href = a.href; });
  }, true);

  // click sweep on buttons
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.btn,button');
    if (!b || b.disabled) return;
    var cs = getComputedStyle(b);
    if (cs.position === 'static') b.style.position = 'relative';
    var prev = b.style.overflow; b.style.overflow = 'hidden';
    var x = document.createElement('span');
    x.style.cssText = 'position:absolute;inset:0;background:currentColor;opacity:.22;pointer-events:none';
    b.appendChild(x);
    x.animate([{ transform: 'translateX(-101%)' }, { transform: 'translateX(101%)' }], { duration: 480, easing: EASE }).onfinish = function () { x.remove(); b.style.overflow = prev; };
  }, true);

  // magnetic primary buttons
  document.addEventListener('pointermove', function (e) {
    var b = e.target.closest && e.target.closest('.btn-primary');
    var cur = window.__fxMag;
    if (cur && cur !== b) { cur.style.transform = ''; window.__fxMag = null; }
    if (!b) return;
    var r = b.getBoundingClientRect();
    var dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    b.style.transform = 'translate(' + (dx * 8).toFixed(1) + 'px,' + (dy * 6).toFixed(1) + 'px)';
    window.__fxMag = b;
  }, { passive: true });

  // frame reveal on scroll / load
  var seen = new WeakSet(), idx = 0;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting || seen.has(en.target)) return;
      seen.add(en.target); io.unobserve(en.target);
      var el = en.target, d = (idx++ % 4) * 90;
      el.animate([{ opacity: 0, transform: 'translateY(32px)' }, { opacity: 1, transform: 'none' }], { duration: 760, delay: d, easing: OUT, fill: 'backwards' });
      var shell = el.children[1];
      if (shell) shell.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 900, delay: d + 60, easing: EASE, fill: 'backwards' });
    });
  }, { threshold: 0.04 });
  function scan() {
    document.querySelectorAll('[id]').forEach(function (el) {
      if (/^\d[a-z]$/.test(el.id) && !el.__fx) { el.__fx = 1; io.observe(el); }
    });
  }
  var t; new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 80); }).observe(document.documentElement, { childList: true, subtree: true });
  scan();

  // staggered entrance for list rows in new content (first paint of lists)
  var rowIO = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting) return;
      rowIO.unobserve(en.target);
      var i = +en.target.__i || 0;
      en.target.animate([{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: Math.min(i, 10) * 35, easing: OUT, fill: 'backwards' });
    });
  }, { threshold: 0.1 });
  function rows() {
    document.querySelectorAll('[style*="border-bottom:1px solid var(--color-divider)"]').forEach(function (el, i) {
      if (el.__row || el.closest('nav')) return; el.__row = 1; el.__i = i % 12; rowIO.observe(el);
    });
  }
  new MutationObserver(function () { clearTimeout(window.__rt); window.__rt = setTimeout(rows, 120); }).observe(document.documentElement, { childList: true, subtree: true });
  rows();
})();
