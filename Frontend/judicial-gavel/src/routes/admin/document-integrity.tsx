import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, CheckCircle, ShieldCheck, FileText } from "lucide-react";
import { AdminPage, AdminCard } from "@/components/admin/AdminPage";
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui";
import { INTEGRITY_DOCUMENTS, SAMPLE_DOCUMENT, type IntegrityDocument } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/document-integrity")({
  component: DocumentIntegrityPage,
  head: () => ({
    meta: [
      { title: "Document Integrity — Legal Eye Admin" },
      {
        name: "description",
        content: "Blockchain-anchored document hashes and verification status for every Legal Eye case file.",
      },
    ],
  }),
});

function CopyableHash({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
      <span className="min-w-0 flex-1 break-all font-mono text-xs text-white">{value}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(value).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  },
                  () => {},
                )
              }
              className="shrink-0 rounded-sm p-1 text-[#8ea3bb] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
              aria-label="Copy hash"
            >
              {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{copied ? "Copied" : "Copy hash"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function DocumentIntegrityPage() {
  const [selectedId, setSelectedId] = React.useState<string>(INTEGRITY_DOCUMENTS[0]?.id ?? "");
  const [verifyMessage, setVerifyMessage] = React.useState<string | null>(null);

  const selected = INTEGRITY_DOCUMENTS.find((d) => d.id === selectedId);
  const verifiedCount = INTEGRITY_DOCUMENTS.filter((d) => d.status === "Verified").length;

  if (!selected) {
    return null;
  }

  function handleVerifyAll() {
    setVerifyMessage(`Sweep complete — ${verifiedCount} of ${INTEGRITY_DOCUMENTS.length} documents verified against the blockchain.`);
    setTimeout(() => setVerifyMessage(null), 4000);
  }

  return (
    <AdminPage
      kicker="LEGAL EYE · ADMIN CONSOLE"
      title="Document Integrity"
      description="Every case file is hashed and anchored to the blockchain. Compare hashes to prove no document has been altered."
      actions={
        <Button variant="outline" size="sm" className="border-[#38bdf8]/40 text-[#38bdf8] hover:bg-[#38bdf8]/10" onClick={handleVerifyAll}>
          <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verify All
        </Button>
      }
    >
      {verifyMessage && (
        <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {verifyMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdminCard className="lg:col-span-2" title="Registered Documents" subtitle={`${verifiedCount} of ${INTEGRITY_DOCUMENTS.length} verified`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a2737] bg-[#0a1320]">
                  {["File", "Case", "Uploaded", "Size", "Block", "Status"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INTEGRITY_DOCUMENTS.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => setSelectedId(doc.id)}
                    className={`cursor-pointer border-b border-[#1a2737] last:border-0 transition-colors hover:bg-[#122236] ${
                      selectedId === doc.id ? "bg-[#122236]" : ""
                    }`}
                  >
                    <td className="px-3 py-3 text-sm text-white">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[#8ea3bb]" />
                        {doc.fileName}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-[#a3b6cd]">{doc.caseRef}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-[#8ea3bb]">{doc.uploaded}</td>
                    <td className="px-3 py-3 text-xs text-[#8ea3bb]">{doc.size}</td>
                    <td className="px-3 py-3 font-mono text-xs text-[#38bdf8]">{doc.blockNumber}</td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={doc.status === "Verified" ? "default" : "secondary"}
                        className={
                          doc.status === "Verified"
                            ? "cursor-default border-emerald-500/40 bg-emerald-500/15 text-[10px] uppercase tracking-wider text-emerald-100"
                            : "cursor-default text-[10px] uppercase tracking-wider text-amber-300"
                        }
                      >
                        {doc.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#1a2737] px-4 py-2">
            <p className="text-[10px] text-[#5f7891]">Select a document to inspect its hash and block details.</p>
          </div>
        </AdminCard>

        <AdminCard title="Integrity Details" subtitle={selected.fileName}>
          <div className="p-4">
            <div className="flex items-start gap-3 rounded-lg border border-[#1a2737] bg-[#0a1320] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#2a1f3d] text-white/80">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="break-all text-sm font-medium text-white">{selected.fileName}</p>
                <p className="mt-1 text-xs text-[#8ea3bb]">Case: {selected.caseRef}</p>
                <p className="text-[10px] text-[#5f7891]">Uploaded: {selected.uploaded} · {selected.size}</p>
              </div>
            </div>

            <Tabs defaultValue="hash" className="mt-4">
              <TabsList className="grid w-full grid-cols-2 border border-[#1a2737]">
                <TabsTrigger value="hash" className="text-xs">Hashes</TabsTrigger>
                <TabsTrigger value="block" className="text-xs">Block Info</TabsTrigger>
              </TabsList>

              <TabsContent value="hash" className="mt-4 space-y-2">
                <CopyableHash value={selected.sha256} />
                <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
                  <span className="text-xs text-[#8ea3bb]">Status</span>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> {selected.status}
                  </span>
                </div>
              </TabsContent>

              <TabsContent value="block" className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
                  <span className="text-xs text-[#8ea3bb]">Blockchain Block</span>
                  <span className="font-mono text-xs text-white">{selected.blockNumber}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
                  <span className="text-xs text-[#8ea3bb]">Verified By</span>
                  <span className="font-mono text-xs text-white">{selected.verifiedBy}</span>
                </div>
                <p className="rounded-md border border-[#1a2737] bg-[#0a1320] p-3 text-xs leading-relaxed text-[#8ea3bb]">
                  SHA-256 digests are computed at upload and anchored on-chain. Any byte-level modification would
                  break the match — the panel shows {SAMPLE_DOCUMENT.blockNumber} as the prototype reference block.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </AdminCard>
      </div>
    </AdminPage>
  );
}
