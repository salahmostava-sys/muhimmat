import { getRouteByPathname } from '@app/routesManifest';

export type ErrorContextSnapshot = {
  pathname: string;
  search?: string;
  userId: string | null;
  routeId?: string;
  /** Manifest route id when matched; otherwise a coarse label for debugging. */
  feature: string;
  routeGroup?: string;
};

let snapshot: ErrorContextSnapshot = {
  pathname: '',
  userId: null,
  feature: 'unknown',
};

/**
 * Updated from navigation + auth so ErrorBoundary (class component) can attach
 * route/user context without hooks.
 */
export function syncErrorContextFromNavigation(
  pathname: string,
  search: string,
  userId: string | null,
) {
  const route = getRouteByPathname(pathname);
  const trimmedSearch = search.replace(/^\?/, '');
  snapshot = {
    pathname,
    search: trimmedSearch || undefined,
    userId,
    routeId: route?.id,
    feature: route?.id ?? 'unmatched',
    routeGroup: route?.group,
  };
}

export function getErrorContextSnapshot(): ErrorContextSnapshot {
  return { ...snapshot };
}
