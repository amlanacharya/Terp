import { useState, useCallback } from 'react';

export interface PaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200, 500, 1000],
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalPages <= 1) {
    return null;
  }

  // Generate page numbers to show
  const pageNumbers: (number | string)[] = [];
  const delta = 1;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - delta && i <= currentPage + delta)
    ) {
      pageNumbers.push(i);
    } else if (
      pageNumbers[pageNumbers.length - 1] !== '...'
    ) {
      pageNumbers.push('...');
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-600">
        Showing {startItem}-{endItem} of {totalItems}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
        >
          &lt; Prev
        </button>

        {pageNumbers.map((pageNum, idx) =>
          pageNum === '...' ? (
            <span key={idx} className="px-2 py-1 text-xs text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={idx}
              onClick={() => onPageChange(pageNum as number)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                currentPage === pageNum
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pageNum}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
        >
          Next &gt;
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600">Show</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-600">per page</span>
      </div>
    </div>
  );
}

/**
 * Hook for managing pagination state with localStorage persistence
 */
export function usePaginationState(moduleKey: string) {
  const storageKey = `travelerp_pageSize_${moduleKey}`;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? Number(saved) : 25;
  });

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    localStorage.setItem(storageKey, String(size));
  }, []);

  return { currentPage, setCurrentPage, pageSize, handlePageSizeChange };
}
