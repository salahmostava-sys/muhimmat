import { beforeEach, describe, expect, it } from 'vitest';
import {
  getErrorContextSnapshot,
  syncErrorContextFromNavigation,
} from './errorContextMeta';

describe('errorContextMeta', () => {
  beforeEach(() => {
    syncErrorContextFromNavigation('', '', null);
  });

  it('maps manifest routes to feature and group', () => {
    syncErrorContextFromNavigation('/employees', '', 'user-1');
    const snap = getErrorContextSnapshot();
    expect(snap.feature).toBe('employees');
    expect(snap.routeGroup).toBe('hr');
    expect(snap.userId).toBe('user-1');
    expect(snap.pathname).toBe('/employees');
  });

  it('records unmatched routes and optional query string', () => {
    syncErrorContextFromNavigation('/made-up', '?x=1', null);
    const snap = getErrorContextSnapshot();
    expect(snap.feature).toBe('unmatched');
    expect(snap.search).toBe('x=1');
  });
});
