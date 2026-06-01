import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationControlsProps {
  page: number;         // 0-indexed current page
  total: number;        // total record count from server
  limit: number;        // records per page
  onPage: (page: number) => void;
  className?: string;
}

export function PaginationControls({
  page,
  total,
  limit,
  onPage,
  className,
}: PaginationControlsProps) {
  if (total <= limit) return null;

  const totalPages = Math.ceil(total / limit);
  const from = page * limit + 1;
  const to = Math.min((page + 1) * limit, total);

  return (
    <div className={`flex items-center justify-between py-3 px-1 ${className ?? ''}`}>
      <p className="text-sm text-muted-foreground">
        {from.toLocaleString()}–{to.toLocaleString()} of{' '}
        <span className="font-medium text-foreground">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm px-3 tabular-nums text-muted-foreground">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages - 1}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
