import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-800 shadow-md">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600 p-3 rounded-lg text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Penetapan Generator</h1>
            <p className="text-slate-400 mt-1">Buat Dokumen Pengadilan Resmi dengan Mudah</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;