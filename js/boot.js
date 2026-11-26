// Runs before the page draws: forwards old addresses, applies a saved theme, and starts visit counting.
(function () {
  // The game moved to Cloudflare. Old GitHub Pages links, Showdown links included, land on the new home.
  if (/github\.io$/.test(location.hostname)) { location.replace('https://playcinch.pages.dev/' + location.search + location.hash); return; }
  try {
    var s = JSON.parse(localStorage.getItem('cinch') || '{}');
    var t = s.settings && s.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch (e) { /* storage blocked */ }
  // Cloudflare Web Analytics counts visits without cookies. Only on the real site, so tests and previews never count.
  if (location.hostname === 'playcinch.pages.dev') {
    var b = document.createElement('script');
    b.defer = true;
    b.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    b.setAttribute('data-cf-beacon', '{"token": "9b90ebeab51848e2afcac98c9ce63f9a"}');
    document.head.appendChild(b);
  }
})();
