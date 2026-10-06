// Client-side navigation with predictable scrolling:
//  - a new page opens at the top, instantly (a smooth scroll from deep down a
//    long page looks like the app is lagging);
//  - Back/Forward return to where the user was on that page (see restoreScroll).
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

function rememberScroll() {
  try {
    window.history.replaceState({ ...(window.history.state || {}), scrollY: window.scrollY }, '');
  } catch {
    // state too large / unavailable — not critical
  }
}

export const navigate = (url: string, options: { keepScroll?: boolean } = {}) => {
  if (!url.startsWith('/')) {
    url = '/' + url;
  }
  rememberScroll();
  window.history.pushState({}, '', url);
  window.dispatchEvent(new CustomEvent('app:locationchange'));
  window.dispatchEvent(new PopStateEvent('popstate'));
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  if (hash) {
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }));
  } else if (!options.keepScroll) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }
};

// Called after Back/Forward. Pages load data asynchronously, so retry briefly
// until the page is tall enough to reach the saved position.
export function restoreScroll() {
  const target = Number(window.history.state?.scrollY) || 0;
  let tries = 0;
  const attempt = () => {
    window.scrollTo({ top: target, left: 0, behavior: 'instant' as ScrollBehavior });
    tries += 1;
    if (Math.abs(window.scrollY - target) > 2 && tries < 12) window.setTimeout(attempt, 80);
  };
  requestAnimationFrame(attempt);
}

// Keeps the saved position fresh so a Back to this entry lands in the right spot.
if (typeof window !== 'undefined') {
  let timer: number | undefined;
  window.addEventListener('scroll', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(rememberScroll, 150);
  }, { passive: true });
}
