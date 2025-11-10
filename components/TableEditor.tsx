"use client";

import React, { useCallback, useRef, useState } from "react";
import { useTableData } from "@/contexts/TableDataContext";
import { CheckCircle, Plus, Download, Save, Trash2, Send, X } from "lucide-react";

/*
  TableEditor usage notes:
  - Drop or browse a CSV file. The first row is used as column headers.
  - Cells are editable inline. "Validate Data" checks row/column counts.
  - This component uses a small built-in CSV parser suitable for common CSVs
    (basic quoted values). For production consider using PapaParse for full
    CSV compatibility.
*/

// Simple CSV parse (handles basic quoted values)
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  for (const line of lines) {
    const row: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

export default function TableEditor() {
  const { data, headers, fileInfo, setData, setHeaders, setFileInfo, clearTableData } = useTableData();
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const accent = "#00FF88";

  const onFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setErrors(["CSV appears to be empty"]);
        setData([]);
        setHeaders([]);
        setFileInfo({ name: file.name, size: file.size });
        return;
      }
      setHeaders(rows[0]);
      setData(rows.slice(1));
      setFileInfo({ name: file.name, size: file.size });
      setErrors([]);
    };
    reader.onerror = () => {
      setErrors(["Failed to read file"]);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFile(e.dataTransfer.files[0]);
    }
  }, [onFile]);

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  const updateCell = (r: number, c: number, value: string) => {
    setData((prev) => {
      const next = prev.map((row) => row.slice());
      // ensure column exists
      while (next[r].length <= c) next[r].push("");
      next[r][c] = value;
      return next;
    });
  };

  const addRow = () => {
    setData((prev) => [...prev, Array(headers.length).fill("")]);
  };

  const addColumn = () => {
    setHeaders((prev) => [...prev, `Column ${prev.length + 1}`]);
    setData((prev) => prev.map((row) => {
      const r = row.slice();
      r.push("");
      return r;
    }));
  };

  const removeColumn = (ci: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== ci));
    setData((prev) => prev.map((row) => {
      const r = row.slice();
      if (ci >= 0 && ci < r.length) r.splice(ci, 1);
      return r;
    }));
  };

  const exportCSV = () => {
    // Build CSV lines with basic quoting
    const quote = (v: string) => {
      if (v == null) return "";
      const s = String(v);
      if (s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
      if (s.includes(',') || s.includes('\n') || s.includes('\r')) return '"' + s + '"';
      return s;
    };

    const rows = [headers, ...data];
    const csv = rows.map((r) => r.map((c) => quote(c ?? "")).join(',')).join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = (fileInfo?.name ?? 'data').replace(/\.csv$/i, '');
    a.download = `${baseName}_edited.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const validateData = () => {
    const errs: string[] = [];
    if (headers.length === 0) errs.push("No headers found");
    const colCount = headers.length;
    data.forEach((row, i) => {
      if (row.length !== colCount) errs.push(`Row ${i + 1} has ${row.length} columns (expected ${colCount})`);
    });
    setErrors(errs);
    return errs.length === 0;
  };

  const saveChanges = () => {
    // For demo: we just validate and show a small success notice in errors (or clear errors)
    const ok = validateData();
    if (ok) {
      setErrors([]);
      setNotice("Saved changes locally.");
      // auto-hide notice after 3s
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const continueToSend = () => {
    const ok = validateData();
    if (ok) {
      // In a real app you'd route to the distribution page with data
      setErrors([]);
      setNotice("Continuing to send — (demo)");
      setTimeout(() => setNotice(null), 3000);
    }
  };

  // When an error banner is shown above the table header we offset the header
  // so the header row remains visible below the banner. Use a fixed banner
  // height (in px) so the sticky header uses the correct top offset.
  const bannerHeight = 44; // px per banner
  const bannerCount = (errors.length > 0 ? 1 : 0) + (notice ? 1 : 0);
  const headerTopOffset = bannerCount * bannerHeight;

  return (
    <div className="min-h-screen bg-white text-slate-900" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto" }}>
      {/* Page header */}
      <header className="border-b py-4 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Table Editor</h1>
          <p className="text-sm text-slate-500 mt-1">Upload, preview, and edit your recipient data before sending.</p>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {/* Upload Card */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="rounded-lg border border-slate-200 p-8 text-center shadow-sm"
            >
              <div className="flex flex-col items-center justify-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-3">
                  <path d="M12 3v9" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 10l5-5 5 5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-lg font-medium">Drag and drop your CSV file here or <button onClick={handleBrowse} style={{ color: accent }} className="underline">click to browse</button>.</div>
                <div className="text-sm text-slate-500 mt-2">CSV only · First row will be used as column names</div>
                <input ref={fileInputRef} onChange={handleFileInput} type="file" accept=".csv,text/csv" className="hidden" />

                {fileInfo ? (
                  <div className="mt-4 text-sm text-slate-700">
                    <div><strong>{fileInfo.name}</strong> • {(fileInfo.size / 1024).toFixed(1)} KB</div>
                    <div className="text-green-600 text-xs mt-1">Upload successful</div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center space-x-3">
                  <button onClick={validateData} style={{ border: `1px solid ${accent}` }} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium">
                    <CheckCircle size={16} />
                    Validate Data
                  </button>
                  <button onClick={addColumn} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm border">
                    <Plus size={16} />
                    Add Column
                  </button>
                  <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm border">
                    <Download size={16} />
                    Export CSV
                  </button>
                  <button onClick={saveChanges} style={{ background: accent }} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white">
                    <Save size={16} />
                    Save Changes
                  </button>
                  <button onClick={() => { clearTableData(); setErrors([]); setNotice(null); }} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-red-500 text-red-600 hover:bg-red-50">
                    <Trash2 size={16} />
                    Clear All
                  </button>
                </div>
              <div>
                <button onClick={continueToSend} style={{ background: accent }} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white">
                  <Send size={16} />
                  Continue to Send
                </button>
              </div>
            </div>

            {/* Table Preview Card */}
            <div className="mt-4 rounded-lg border border-slate-100 shadow-sm overflow-hidden">
              {notice && (
                <div className="p-3 bg-green-50 border-b border-green-200 text-green-800 text-sm">
                  {notice}
                </div>
              )}
              <div className="overflow-auto max-h-[60vh]">
                <table className="min-w-full table-auto border-collapse">
                  <thead className="bg-white">
                    {/* If there are errors, render a sticky error row above the header cells
                        so the message stays visible at the top of the table area. */}
                    {errors.length > 0 && (
                      <tr>
                        <th colSpan={Math.max(headers.length, 1)}
                            className="text-left px-4 py-2 border-b"
                            style={{ position: 'sticky', top: 0, background: '#fff5f5', zIndex: 12 }}>
                          <div className="text-sm text-red-800">{errors.map((e, i) => (<div key={i}>{e}</div>))}</div>
                        </th>
                      </tr>
                    )}
                    <tr>
                      {headers.length > 0 ? headers.map((h, ci) => (
                        <th key={ci} className="text-left px-4 py-3 border-b min-w-40" style={{ position: 'sticky', top: headerTopOffset, background: 'white', zIndex: 10 }}>
                          <div className="flex items-center space-x-2">
                              <input
                                value={h}
                                onChange={(e) => setHeaders((prev) => {
                                  const next = prev.slice();
                                  next[ci] = e.target.value;
                                  return next;
                                })}
                                className="w-full bg-transparent outline-none text-sm font-semibold"
                                title={h}
                              />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeColumn(ci);
                              }}
                              title="Remove column"
                              className="text-red-500 text-sm px-1 hover:bg-red-50 rounded"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </th>
                      )) : (
                        <th className="px-4 py-3 text-slate-400">No data loaded</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        {headers.map((_, ci) => (
                          <td key={ci} className="px-3 py-2 align-top border-b min-w-40">
                            <input
                              value={row[ci] ?? ""}
                              onChange={(e) => updateCell(ri, ci, e.target.value)}
                              className="w-full bg-transparent outline-none text-sm"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t bg-white flex items-center justify-between">
                <div className="text-sm text-slate-600">Rows: {data.length} · Columns: {headers.length}</div>
                <div>
                  <button onClick={addRow} className="flex items-center gap-1 px-3 py-1 text-sm rounded border hover:bg-gray-50">
                    <Plus size={14} />
                    Add row
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="rounded-lg border p-4 shadow-sm sticky top-20 bg-white">
              <h4 className="text-sm font-semibold">CSV Info</h4>
              <div className="mt-3 text-sm text-slate-600">
                <div>Rows: <strong>{data.length}</strong></div>
                <div>Columns: <strong>{headers.length}</strong></div>
                <div className="mt-2">Errors: <strong className="text-red-600">{errors.length}</strong></div>
              </div>
              <div className="mt-4">
                <button onClick={() => { clearTableData(); setErrors([]); }} className="w-full px-3 py-2 rounded-md border text-sm">Re-upload CSV</button>
              </div>
            </div>
          </aside>
        </div>

        {/* Note: error details are shown inside the table preview area (sticky row) to avoid duplicates */}
      </div>
    </div>
  );
}
