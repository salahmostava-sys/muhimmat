import { create } from 'zustand';

export type SortDir = 'asc' | 'desc' | null;

export type EmployeesPageState = {
  sortField: string | null;
  sortDir: SortDir;
  colFilters: Record<string, string>;
  page: number;
  pageSize: number;
  visibleCols: string[];

  setSortField: (v: string | null) => void;
  setSortDir: (v: SortDir) => void;
  setColFilters: (v: Record<string, string>) => void;
  setColFilter: (key: string, value: string) => void;
  setPage: (v: number | ((prev: number) => number)) => void;
  setPageSize: (v: number) => void;
  setVisibleCols: (cols: string[] | ((prev: string[]) => string[])) => void;
  reset: () => void;
};

type Init = {
  defaultVisibleCols: string[];
};

export const createEmployeesPageStore = ({ defaultVisibleCols }: Init) =>
  create<EmployeesPageState>((set) => ({
    sortField: 'name',
    sortDir: 'asc',
    colFilters: {},
    page: 1,
    pageSize: 50,
    visibleCols: defaultVisibleCols,

    setSortField: (v) => set({ sortField: v }),
    setSortDir: (v) => set({ sortDir: v }),
    setColFilters: (v) => set({ colFilters: v }),
    setColFilter: (key, value) =>
      set((s) => {
        const next = { ...s.colFilters };
        if (!value || value === 'all') delete next[key];
        else next[key] = value;
        return { colFilters: next };
      }),
    setPage: (v) =>
      set((s) => ({ page: typeof v === 'function' ? (v as (p: number) => number)(s.page) : v })),
    setPageSize: (v) => set({ pageSize: v }),
    setVisibleCols: (cols) =>
      set((s) => ({ visibleCols: typeof cols === 'function' ? (cols as (p: string[]) => string[])(s.visibleCols) : cols })),
    reset: () =>
      set({
        sortField: 'name',
        sortDir: 'asc',
        colFilters: {},
        page: 1,
        pageSize: 50,
        visibleCols: defaultVisibleCols,
      }),
  }));

