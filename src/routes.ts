export type AppScreen = 'home' | 'owner' | 'booking' | 'prices' | 'care';

const paths: Record<AppScreen, string> = {
  home: 'customer/',
  owner: 'owner/',
  booking: 'customer/booking/',
  prices: 'customer/prices/',
  care: 'customer/care/',
};
const isScreen = (value: string | null): value is AppScreen => value !== null && Object.hasOwn(paths, value);

/** Path selection is navigation only; the server remains responsible for access. */
export function parseEntry(source: URL): { screen: AppScreen; basePath: string } {
  const pathname = source.pathname;
  const route = /\/(owner|customer(?:\/(booking|prices|care))?)(?:\/index\.html)?\/?$/.exec(pathname);
  if (route) {
    return { screen: route[1] === 'owner' ? 'owner' : (route[2] as Exclude<AppScreen, 'owner'> | undefined) ?? 'home', basePath: pathname.slice(0, route.index + 1) };
  }
  // Unknown children of a public namespace stay public, including forged queries.
  const publicNamespace = /\/customer\//.exec(pathname);
  if (publicNamespace) return { screen: 'booking', basePath: pathname.slice(0, publicNamespace.index + 1) };
  const basePath = pathname.endsWith('/index.html') ? pathname.slice(0, -'index.html'.length)
    : pathname.endsWith('/') ? pathname
      : /\.[^/]+$/.test(pathname) ? new URL('.', source).pathname : `${pathname}/`;
  const legacy = source.searchParams.get('screen');
  return { screen: isScreen(legacy) ? legacy : 'home', basePath };
}

export function resolveScreen(source: URL = new URL(window.location.href)): AppScreen {
  return parseEntry(source).screen;
}

export function appUrl(screen: AppScreen, params: Record<string, string> = {}, source: URL = new URL(window.location.href)): string {
  const base = new URL(parseEntry(source).basePath, source.origin);
  const target = new URL(paths[screen], base);
  for (const [key, value] of Object.entries(params)) if (key !== 'screen') target.searchParams.set(key, value);
  return target.toString();
}

/** Pin assets to the deployment root before canonicalizing a legacy entry URL. */
export function normalizeEntry(): AppScreen {
  const source = new URL(window.location.href);
  const entry = parseEntry(source);
  let base = document.querySelector<HTMLBaseElement>('base');
  if (!base) { base = document.createElement('base'); document.head.prepend(base); }
  base.href = new URL(entry.basePath, source.origin).toString();
  const params = Object.fromEntries(source.searchParams.entries());
  delete params.screen;
  const target = new URL(appUrl(entry.screen, params, source));
  target.hash = source.hash;
  if (target.href !== source.href) window.history.replaceState(window.history.state, '', target);
  return entry.screen;
}
