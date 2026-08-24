"use client";

import { ChevronDown, Download, Upload, Store } from "lucide-react";
import StatusDot from "@/components/ui/StatusDot";
import { bulkUploads } from "@/lib/mock-data";

export default function BulkUploadsPage() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Bulk Uploads</h1>
        <button className="flex items-center gap-2 rounded-lg border border-border-color bg-brand-orange-light px-4 py-2 text-sm font-medium text-text-primary">
          <Store size={16} />
          All stores
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-dashed border-border-color bg-card-bg px-8 py-10 text-center">
        <div className="mb-3 flex justify-center text-text-muted">
          <Download size={28} />
        </div>
        <div className="mb-1 text-base font-bold text-text-primary">
          Download Template
        </div>
        <div className="mb-5 text-sm text-text-muted">
          Please download a template (csv/xlsx) to fill in information
          <br />
          for your payment links to be created
        </div>
        <div className="flex justify-center gap-3">
          <button className="flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white">
            <Download size={16} />
            Download Basic as CSV
            <ChevronDown size={14} />
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white">
            <Download size={16} />
            Download Extended as CSV
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-dashed border-border-color bg-card-bg px-8 py-10 text-center">
        <div className="mb-3 flex justify-center text-text-muted">
          <Upload size={28} />
        </div>
        <div className="text-sm">
          <span className="font-semibold text-brand-blue">Browse</span>
        </div>
        <div className="text-sm text-text-muted">
          Allowed file types are CSV XLSX
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border-color text-left text-text-secondary">
              <th className="px-4 py-3 font-medium">File Name</th>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Date Added</th>
              <th className="px-4 py-3 font-medium">Date Processed</th>
              <th className="px-4 py-3 font-medium">Number of payment links</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {bulkUploads.map((b) => (
              <tr
                key={b.id}
                className="border-b border-border-color last:border-0 hover:bg-page-bg/60"
              >
                <td className="px-4 py-3 text-text-primary">{b.fileName}</td>
                <td className="px-4 py-3 text-text-muted">{b.uploadId}</td>
                <td className="px-4 py-3 text-text-primary">
                  {b.dateAdded.slice(0, 10)}
                </td>
                <td className="px-4 py-3 text-text-primary">
                  {b.dateProcessed.slice(0, 10)}
                </td>
                <td className="px-4 py-3 text-text-primary">
                  {b.numberOfLinks}
                </td>
                <td className="px-4 py-3">
                  <StatusDot status={b.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
