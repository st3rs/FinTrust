import { useState } from 'react';

export const DEFAULT_PAGE_SIZE = 20;

export interface PaginationState {
  page: number;
  limit: number;
  offset: number;
  goTo: (page: number) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

export function usePagination(limit = DEFAULT_PAGE_SIZE): PaginationState {
  const [page, setPage] = useState(0);

  return {
    page,
    limit,
    offset: page * limit,
    goTo: setPage,
    next: () => setPage((p) => p + 1),
    prev: () => setPage((p) => Math.max(0, p - 1)),
    reset: () => setPage(0),
  };
}
