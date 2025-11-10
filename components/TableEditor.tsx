"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTableData } from "@/contexts/TableDataContext";
import { BACKEND_BASE_URL } from "@/lib/config";
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

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data === "string") return data;
    return data?.detail || data?.error || data?.message || response.statusText;
  } catch {
    try {
      const text = await response.text();
      return text || response.statusText;
    } catch {
      return response.statusText;
    }
  }
}

type TemplateOption = {
  id: string;
  name: string;
  subject: string;
  filename?: string;
};

export default function TableEditor() {
  const { data, headers, fileInfo, setData, setHeaders, setFileInfo, clearTableData } = useTableData();
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [subjectManuallyEdited, setSubjectManuallyEdited] = useState(false);
  const [withAttachments, setWithAttachments] = useState(true);
  const [ccInput, setCcInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const accent = "#00FF88";

  useEffect(() => {
    let isMounted = true;

    async function loadTemplates() {
      try {
        const response = await fetch("/api/templates");
        if (!response.ok) {
          console.error("Failed to load templates:", response.statusText);
          return;
        }
        const data = await response.json();
        const normalized: TemplateOption[] = (data.templates ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          subject: t.subject,
          filename: t.filename,
        }));
        if (!isMounted) {
          return;
        }
        setTemplates(normalized);
        if (normalized.length > 0) {
          setSelectedTemplateId(normalized[0].id);
          setEmailSubject(normalized[0].subject || "");
          setSubjectManuallyEdited(false);
        }
      } catch (error) {
        console.error("Error loading templates:", error);
      }
    }

    loadTemplates();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleTemplateChange = (templateId: string) => {
    setSendError(null);
    setSendSuccess(null);
    const previousTemplate = templates.find((t) => t.id === selectedTemplateId);
    const nextTemplate = templates.find((t) => t.id === templateId);
    setSelectedTemplateId(templateId);
    if (
      !subjectManuallyEdited ||
      emailSubject.trim() === (previousTemplate?.subject ?? "").trim()
    ) {
      setEmailSubject(nextTemplate?.subject || "");
      setSubjectManuallyEdited(false);
    }
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

  const handleSend = async () => {
    setSendError(null);
    setSendSuccess(null);

    const ok = validateData();
    if (!ok) {
      setSendError("Please resolve the data validation issues before sending.");
      return;
    }

    if (!selectedTemplateId) {
      setSendError("Select an email template before sending.");
      return;
    }

    if (data.length === 0) {
      setSendError("Add at least one recipient row before sending.");
      return;
    }

    const normalizedHeaders = headers.map((h) => (h || "").trim().toLowerCase());
    if (!normalizedHeaders.includes("email")) {
      setSendError('Your dataset must include an "email" column.');
      return;
    }
    if (!normalizedHeaders.includes("recipient")) {
      setSendError('Your dataset must include a "recipient" column.');
      return;
    }

    const rows = data.map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        const key = (header ?? "").trim();
        if (!key) return;
        record[key] = row[index] ?? "";
      });
      return record;
    });

    setIsSending(true);
    try {
      const uploadResponse = await fetch(`${BACKEND_BASE_URL}/upload-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });

      if (!uploadResponse.ok) {
        const message = await parseErrorResponse(uploadResponse);
        throw new Error(message || "Failed to upload data to the backend.");
      }

      const uploadPayload = await uploadResponse.json();
      const uploadId = uploadPayload?.upload_id;
      if (!uploadId) {
        throw new Error("Backend response missing upload_id.");
      }

      const ccList = ccInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        upload_id: uploadId,
        with_attachments: withAttachments,
        skip_sent: true,
        cc_list: ccList,
        template_id: selectedTemplateId,
      };

      if (emailSubject.trim()) {
        payload.subject = emailSubject.trim();
      }

      const sendResponse = await fetch(`${BACKEND_BASE_URL}/emails/send-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let sendPayload: any = null;
      try {
        sendPayload = await sendResponse.json();
      } catch {
        // ignore JSON parse errors; we'll handle message below
      }

      if (!sendResponse.ok) {
        const message =
          sendPayload?.detail ||
          sendPayload?.error ||
          sendPayload?.message ||
          sendResponse.statusText;
        throw new Error(message || "Failed to start bulk email job.");
      }

      const message =
        sendPayload?.message ||
        `Bulk email job started for ${
          sendPayload?.row_count ?? rows.length
        } recipient${rows.length === 1 ? "" : "s"}.`;

      setSendSuccess(message);
      setNotice(null);
    } catch (error: any) {
      setSendError(error?.message || "Failed to send emails.");
    } finally {
      setIsSending(false);
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
                <button
                  onClick={handleSend}
                  disabled={isSending || !selectedTemplateId}
                  style={{
                    background: accent,
                    opacity: isSending || !selectedTemplateId ? 0.6 : 1,
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                  {isSending ? "Sending..." : "Send Emails"}
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
            <div className="space-y-4 sticky top-20">
              <div className="rounded-lg border p-4 shadow-sm bg-white">
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

              <div className="rounded-lg border p-4 shadow-sm bg-white">
                <h4 className="text-sm font-semibold">Send Settings</h4>

                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Template
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => handleTemplateChange(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  >
                    <option value="" disabled>
                      {templates.length === 0 ? "Loading templates..." : "Select a template"}
                    </option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Templates are managed in the Template Editor.
                  </p>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Email Subject
                  </label>
                  <input
                    value={emailSubject}
                    onChange={(event) => {
                      setEmailSubject(event.target.value);
                      setSubjectManuallyEdited(true);
                      setSendError(null);
                      setSendSuccess(null);
                    }}
                    placeholder="Use template subject"
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const selected = templates.find((t) => t.id === selectedTemplateId);
                      setEmailSubject(selected?.subject || "");
                      setSubjectManuallyEdited(false);
                      setSendError(null);
                      setSendSuccess(null);
                    }}
                    className="mt-1 text-xs text-slate-500 underline"
                  >
                    Use template subject
                  </button>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                    CC Emails
                  </label>
                  <input
                    value={ccInput}
                    onChange={(event) => {
                      setCcInput(event.target.value);
                      setSendError(null);
                      setSendSuccess(null);
                    }}
                    placeholder="cc1@example.com, cc2@example.com"
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  />
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <input
                    id="with-attachments"
                    type="checkbox"
                    checked={withAttachments}
                    onChange={(event) => {
                      setWithAttachments(event.target.checked);
                      setSendError(null);
                      setSendSuccess(null);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  <label htmlFor="with-attachments" className="text-sm text-slate-600">
                    Attach matching PDFs (if available)
                  </label>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Required columns: <code>recipient</code> and <code>email</code>.
                </p>

                {sendError ? (
                  <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {sendError}
                  </div>
                ) : null}
                {sendSuccess ? (
                  <div className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {sendSuccess}
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>

        {/* Note: error details are shown inside the table preview area (sticky row) to avoid duplicates */}
      </div>
    </div>
  );
}
