export type PagedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

export const createPagedResult = <T>(params: {
  rows: T[] | null | undefined;
  total: number | null | undefined;
  page: number;
  pageSize: number;
}): PagedResult<T> => ({
  rows: params.rows ?? [],
  total: params.total ?? 0,
  page: params.page,
  pageSize: params.pageSize,
});
