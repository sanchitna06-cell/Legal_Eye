import { Download, EllipsisVertical, FileText, Printer } from "lucide-react";
import { getDocument, type BackendDocument ,type DocumentProcessingStatus,} from "@/lib/api";

interface DocumentHeaderProps {
  document: BackendDocument;
  processingStatus: DocumentProcessingStatus | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Document metadata strip above the viewer: evidence-style serif title,
 * ACTIVE seal, document id and intake metadata; retrieval actions on the
 * right. Data comes from the existing authenticated document record.
 */
export function DocumentHeader({
  document,
  processingStatus,
}: DocumentHeaderProps) {
    async function handleDownload() {
    try {
      const access = await getDocument(document.id);

      const response = await fetch(access.url);

      if (!response.ok) {
        throw new Error("Failed to download document.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.file_name;

      window.document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Document download failed:", error);
    }
  }
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-border px-5 py-5">
      <div className="flex min-w-0 items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center border border-brass/50 bg-brass/[0.06]"
        >
          <FileText className="h-5 w-5 text-brass" />
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate font-display text-xl leading-tight text-parchment">
              {document.file_name.replace(/\.[^.]+$/, "")}
            </h1>
            <span className="border border-olive/50 bg-olive/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.16em] text-olive uppercase">
              Active
            </span>
          </div>

          <p className="mt-1 truncate font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
            {document.id}
          </p>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Uploaded {formatDate(document.uploaded_at)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatSize(document.file_size_bytes)}</span>
            {document.status && document.status !== "ready" && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tracking-[0.1em] uppercase">{document.status}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          title="Download original"
          aria-label="Download original document"
          onClick={handleDownload}
          className="focus-legal flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-brass-dim hover:text-parchment"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Print"
          aria-label="Print document"
          className="focus-legal flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-brass-dim hover:text-parchment"
        >
          <Printer className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="More options"
          aria-label="More document options"
          className="focus-legal flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-brass-dim hover:text-parchment"
        >
          <EllipsisVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
