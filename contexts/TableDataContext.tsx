"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

type TableDataContextType = {
  data: string[][];
  headers: string[];
  fileInfo: { name: string; size: number } | null;
  setData: React.Dispatch<React.SetStateAction<string[][]>>;
  setHeaders: React.Dispatch<React.SetStateAction<string[]>>;
  setFileInfo: React.Dispatch<React.SetStateAction<{ name: string; size: number } | null>>;
  clearTableData: () => void;
};

const TableDataContext = createContext<TableDataContextType | undefined>(undefined);

export function TableDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);

  const clearTableData = () => {
    setData([]);
    setHeaders([]);
    setFileInfo(null);
  };

  return (
    <TableDataContext.Provider
      value={{
        data,
        headers,
        fileInfo,
        setData,
        setHeaders,
        setFileInfo,
        clearTableData,
      }}
    >
      {children}
    </TableDataContext.Provider>
  );
}

export function useTableData() {
  const context = useContext(TableDataContext);
  if (context === undefined) {
    throw new Error('useTableData must be used within a TableDataProvider');
  }
  return context;
}
