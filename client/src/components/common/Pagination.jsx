import React from 'react';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null; // Không hiển thị nếu chỉ có 1 trang

  const handleClick = (page) => {
    if (page !== currentPage && page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  // Hiển thị số lượng trang: [1] ... [4] [5] [6] ... [10]
  const renderPageNumbers = () => {
    const pageNumbers = [];
    const delta = 2;

    const range = {
      start: Math.max(2, currentPage - delta),
      end: Math.min(totalPages - 1, currentPage + delta),
    };

    if (range.start > 2) {
      pageNumbers.push(<span key="start-ellipsis">...</span>);
    }

    for (let i = range.start; i <= range.end; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => handleClick(i)}
          className={`px-3 py-1 rounded ${
            currentPage === i
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          {i}
        </button>
      );
    }

    if (range.end < totalPages - 1) {
      pageNumbers.push(<span key="end-ellipsis">...</span>);
    }

    return pageNumbers;
  };

  return (
    <div className="flex justify-center mt-6 space-x-2 flex-wrap">
      {/* Nút Trang đầu */}
      <button
        onClick={() => handleClick(1)}
        disabled={currentPage === 1}
        className={`px-3 py-1 rounded ${
          currentPage === 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'
        }`}
      >
        «
      </button>

      {/* Trang 1 luôn hiển thị */}
      <button
        onClick={() => handleClick(1)}
        className={`px-3 py-1 rounded ${
          currentPage === 1
            ? 'bg-green-600 text-white'
            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
        }`}
      >
        1
      </button>

      {/* Các trang giữa */}
      {renderPageNumbers()}

      {/* Trang cuối luôn hiển thị nếu > 1 */}
      {totalPages > 1 && (
        <button
          onClick={() => handleClick(totalPages)}
          className={`px-3 py-1 rounded ${
            currentPage === totalPages
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          {totalPages}
        </button>
      )}

      {/* Nút Trang cuối */}
      <button
        onClick={() => handleClick(totalPages)}
        disabled={currentPage === totalPages}
        className={`px-3 py-1 rounded ${
          currentPage === totalPages ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'
        }`}
      >
        »
      </button>
    </div>
  );
};

export default Pagination;
