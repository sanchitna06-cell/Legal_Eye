import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Copy,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  getAdminBlockchain,
  getAdminDocumentIntegrity,
  type AdminBlockchainBlock,
  type AdminDocumentIntegrity,
} from "@/lib/api";

import {
  AdminPage,
  AdminCard,
} from "@/components/admin/AdminPage";

import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui";


export const Route = createFileRoute(
  "/admin/document-integrity",
)({
  component: DocumentIntegrityPage,

  head: () => ({
    meta: [
      {
        title: "Document Integrity — Jury Hash Admin",
      },
      {
        name: "description",
        content:
          "Document integrity records, SHA-256 hashes, and blockchain anchors recorded by the Jury Hash backend.",
      },
    ],
  }),
});


/* ================================================================
   COPYABLE HASH
   ================================================================ */

function CopyableHash({
  value,
}: {
  value: string;
}) {
  const [copied, setCopied] =
    React.useState(false);


  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        value,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  }


  return (
    <div className="admin-integrity-hash">
      <div className="admin-integrity-hash__content">
        <p className="admin-integrity-hash__label">
          SHA-256 DIGEST
        </p>

        <div
          className="admin-integrity-hash__value-wrap"
          title={value}
        >
          <span className="admin-integrity-hash__value">
            {value}
          </span>
        </div>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() =>
                void handleCopy()
              }
              className="admin-integrity-copy"
              aria-label={
                copied
                  ? "Hash copied"
                  : "Copy SHA-256 digest"
              }
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </TooltipTrigger>

          <TooltipContent side="left">
            {copied
              ? "Copied"
              : "Copy SHA-256 digest"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}


/* ================================================================
   DATE
   ================================================================ */

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}


/* ================================================================
   PAGE
   ================================================================ */

function DocumentIntegrityPage() {
  const [
    records,
    setRecords,
  ] = React.useState<
    AdminDocumentIntegrity[]
  >([]);

  const [
    blocks,
    setBlocks,
  ] = React.useState<
    AdminBlockchainBlock[]
  >([]);

  const [
    selectedId,
    setSelectedId,
  ] = React.useState<
    string | null
  >(null);

  const [
    loading,
    setLoading,
  ] = React.useState(true);

  const [
    error,
    setError,
  ] = React.useState<string | null>(
    null,
  );

  const [
    reviewMessage,
    setReviewMessage,
  ] = React.useState<string | null>(
    null,
  );


  /* ==============================================================
     LOAD DATA
     ============================================================== */

  const loadIntegrity =
    React.useCallback(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const [
            integrityData,
            blockchainData,
          ] = await Promise.all([
            getAdminDocumentIntegrity(
              0,
              500,
            ),

            getAdminBlockchain(
              0,
              500,
            ),
          ]);

          setRecords(
            integrityData,
          );

          setBlocks(
            blockchainData,
          );

          setSelectedId(
            (current) => {
              if (
                current &&
                integrityData.some(
                  (record) =>
                    record.id === current,
                )
              ) {
                return current;
              }

              return (
                integrityData[0]?.id ??
                null
              );
            },
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load document integrity records.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );


  React.useEffect(() => {
    void loadIntegrity();
  }, [loadIntegrity]);


  /* ==============================================================
     SELECTED RECORD
     ============================================================== */

  const selected =
    records.find(
      (record) =>
        record.id === selectedId,
    ) ?? null;


  /* ==============================================================
     BLOCK MAP
     ============================================================== */

  const blockMap =
    React.useMemo(
      () =>
        new Map(
          blocks.map(
            (block) => [
              block.id,
              block,
            ],
          ),
        ),
      [blocks],
    );


  /* ==============================================================
     COUNTS
     ============================================================== */

  const anchoredCount =
    React.useMemo(
      () =>
        records.filter(
          (record) =>
            record.blockchain_block_id !==
              null &&
            record.blockchain_hash !==
              null &&
            record.anchored_at !==
              null,
        ).length,
      [records],
    );


  const pendingCount =
    records.length -
    anchoredCount;


  /* ==============================================================
     ANCHOR REVIEW
     ============================================================== */

  function handleReviewAnchors() {
    const anchored =
      records.filter(
        (record) =>
          record.blockchain_block_id !==
            null &&
          record.blockchain_hash !==
            null &&
          record.anchored_at !==
            null,
      ).length;

    setReviewMessage(
      `Anchor review complete — ${anchored} of ${records.length} records are blockchain-anchored.`,
    );

    window.setTimeout(() => {
      setReviewMessage(null);
    }, 4000);
  }


  /* ==============================================================
     LOADING
     ============================================================== */

  if (loading) {
    return (
      <AdminPage
        kicker="JURY HASH · ADMIN CONSOLE"
        title="Document Integrity"
        description="Document integrity records, SHA-256 hashes, and blockchain anchors recorded by the Jury Hash backend."
      >
        <div className="admin-table-empty">
          Loading integrity records…
        </div>
      </AdminPage>
    );
  }


  /* ==============================================================
     ERROR
     ============================================================== */

  if (error) {
    return (
      <AdminPage
        kicker="JURY HASH · ADMIN CONSOLE"
        title="Document Integrity"
        description="Document integrity records, SHA-256 hashes, and blockchain anchors recorded by the Jury Hash backend."
      >
        <div className="admin-alert admin-alert--danger">
          {error}
        </div>
      </AdminPage>
    );
  }


  /* ==============================================================
     EMPTY
     ============================================================== */

  if (records.length === 0) {
    return (
      <AdminPage
        kicker="JURY HASH · ADMIN CONSOLE"
        title="Document Integrity"
        description="Document integrity records, SHA-256 hashes, and blockchain anchors recorded by the Jury Hash backend."
        actions={
          <Button
            type="button"
            onClick={() =>
              void loadIntegrity()
            }
            className="admin-button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      >
        <div className="admin-table-empty">
          No document integrity records found.
        </div>
      </AdminPage>
    );
  }


  /* ==============================================================
     MAIN
     ============================================================== */

  return (
    <AdminPage
      kicker="JURY HASH · ADMIN CONSOLE"
      title="Document Integrity"
      description="Document integrity records, SHA-256 hashes, and blockchain anchors recorded by the Jury Hash backend."
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() =>
              void loadIntegrity()
            }
            disabled={loading}
            className="admin-button"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                loading
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </Button>

          <Button
            type="button"
            onClick={
              handleReviewAnchors
            }
            className="admin-button admin-button--primary"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Review Anchors
          </Button>
        </div>
      }
    >
      {/* ============================================================
          REVIEW MESSAGE
          ============================================================ */}

      {reviewMessage && (
        <div className="admin-alert admin-alert--success">
          <CheckCircle2 className="h-3.5 w-3.5" />

          {reviewMessage}
        </div>
      )}


      {/* ============================================================
          SUMMARY
          ============================================================ */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <IntegrityMetric
          label="Integrity Records"
          value={records.length}
        />

        <IntegrityMetric
          label="Blockchain Anchored"
          value={anchoredCount}
          tone="success"
        />

        <IntegrityMetric
          label="Pending Anchors"
          value={pendingCount}
          tone={
            pendingCount > 0
              ? "warning"
              : "neutral"
          }
        />
      </div>


      {/* ============================================================
          RECORDS + DETAILS
          ============================================================ */}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ----------------------------------------------------------
            RECORDS
            ---------------------------------------------------------- */}

        <AdminCard
          className="admin-card--large"
          title="Integrity Records"
          subtitle={`${anchoredCount} of ${records.length} blockchain-anchored`}
        >
          <div className="overflow-x-auto">
            <table className="admin-integrity-table">
              <thead>
                <tr className="admin-table-head">
                  <th className="admin-table-heading">
                    Case File
                  </th>

                  <th className="admin-table-heading">
                    Algorithm
                  </th>

                  <th className="admin-table-heading">
                    Registered
                  </th>

                  <th className="admin-table-heading">
                    Hash
                  </th>

                  <th className="admin-table-heading">
                    Block
                  </th>

                  <th className="admin-table-heading">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {records.map(
                  (record) => {
                    const block =
                      record.blockchain_block_id
                        ? blockMap.get(
                            record.blockchain_block_id,
                          )
                        : null;

                    const isAnchored =
                      record.blockchain_block_id !==
                        null &&
                      record.blockchain_hash !==
                        null &&
                      record.anchored_at !==
                        null;

                    const isSelected =
                      selectedId ===
                      record.id;

                    return (
                      <tr
                        key={record.id}
                        onClick={() =>
                          setSelectedId(
                            record.id,
                          )
                        }
                        className={`admin-integrity-row ${
                          isSelected
                            ? "admin-integrity-row--selected"
                            : ""
                        }`}
                      >
                        <td className="admin-table-cell">
                          <span
                            className="admin-integrity-file"
                            title={
                              record.case_file_id
                            }
                          >
                            <FileText className="admin-integrity-file__icon" />

                            <span className="admin-integrity-file__name">
                              {
                                record.case_file_id
                              }
                            </span>
                          </span>
                        </td>

                        <td className="admin-table-cell admin-table-cell--mono">
                          {record.algorithm}
                        </td>

                        <td className="admin-table-cell admin-table-cell--muted">
                          {formatDate(
                            record.created_at,
                          )}
                        </td>

                        <td
                          className="admin-table-cell admin-table-cell--hash"
                          title={
                            record.sha256_hash
                          }
                        >
                          {record.sha256_hash.slice(
                            0,
                            16,
                          )}
                          …
                        </td>

                        <td className="admin-table-cell admin-table-cell--block">
                          {block
                            ? `#${block.block_index}`
                            : record.blockchain_block_id
                              ? `${record.blockchain_block_id.slice(0, 10)}…`
                              : "—"}
                        </td>

                        <td className="admin-table-cell">
                          <span
                            className={`admin-integrity-status ${
                              isAnchored
                                ? "admin-integrity-status--anchored"
                                : "admin-integrity-status--pending"
                            }`}
                          >
                            <span className="admin-integrity-status__dot" />

                            {isAnchored
                              ? "Anchored"
                              : "Pending"}
                          </span>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>


          <div className="admin-integrity-table-note">
            Select a record to inspect its
            SHA-256 digest and blockchain
            anchor.
          </div>
        </AdminCard>


        {/* ----------------------------------------------------------
            DETAILS
            ---------------------------------------------------------- */}

        {selected && (
          <AdminCard
            className="lg:col-span-1"
            title="Integrity Details"
            subtitle={`Case file ${selected.case_file_id}`}
          >
            <div className="admin-integrity-details">

              {/* FILE */}

              <div className="admin-integrity-file-card">
                <div className="admin-integrity-file-card__icon">
                  <FileText />
                </div>

                <div className="admin-integrity-file-card__content">
                  <p className="admin-integrity-file-card__title">
                    Case File
                  </p>

                  <p
                    className="admin-integrity-file-card__id"
                    title={
                      selected.case_file_id
                    }
                  >
                    {selected.case_file_id}
                  </p>

                  <p className="admin-integrity-file-card__date">
                    Registered:{" "}
                    {formatDate(
                      selected.created_at,
                    )}
                  </p>
                </div>
              </div>


              {/* STATUS */}

              <div
                className={`admin-integrity-verification ${
                  selected.blockchain_block_id
                    ? "admin-integrity-verification--anchored"
                    : "admin-integrity-verification--pending"
                }`}
              >
                <div className="admin-integrity-verification__icon">
                  <ShieldCheck className="h-4 w-4" />
                </div>

                <div className="admin-integrity-verification__content">
                  <div className="admin-integrity-verification__heading">
                    <p className="admin-integrity-verification__title">
                      {selected.blockchain_block_id
                        ? "Blockchain Anchor Present"
                        : "Blockchain Anchor Pending"}
                    </p>

                    {selected.blockchain_block_id &&
                      blockMap.get(
                        selected.blockchain_block_id,
                      ) && (
                        <span className="admin-integrity-verification__block">
                          #
                          {
                            blockMap.get(
                              selected.blockchain_block_id,
                            )!.block_index
                          }
                        </span>
                      )}
                  </div>

                  <p className="admin-integrity-verification__description">
                    {selected.blockchain_block_id
                      ? "A corresponding blockchain block is recorded for this integrity record."
                      : "This integrity record has not yet been linked to a blockchain block."}
                  </p>
                </div>
              </div>


              {/* TABS */}

              <Tabs
                defaultValue="hash"
                className="admin-integrity-tabs"
              >
                <TabsList className="admin-integrity-tabs__list">
                  <TabsTrigger
                    value="hash"
                    className="admin-integrity-tabs__trigger"
                  >
                    Hash
                  </TabsTrigger>

                  <TabsTrigger
                    value="block"
                    className="admin-integrity-tabs__trigger"
                  >
                    Block Info
                  </TabsTrigger>
                </TabsList>


                {/* HASH TAB */}

                <TabsContent
                  value="hash"
                  className="admin-integrity-tabs__content"
                >
                  <CopyableHash
                    value={
                      selected.sha256_hash
                    }
                  />

                  <IntegrityDetailRow
                    label="Algorithm"
                    value={
                      selected.algorithm
                    }
                    mono
                  />

                  <IntegrityDetailRow
                    label="Anchor Status"
                    value={
                      selected.blockchain_block_id
                        ? "Anchored"
                        : "Not Anchored"
                    }
                    status={
                      selected.blockchain_block_id
                        ? "success"
                        : "warning"
                    }
                  />

                  <IntegrityDetailRow
                    label="Anchored At"
                    value={formatDate(
                      selected.anchored_at,
                    )}
                  />
                </TabsContent>


                {/* BLOCK TAB */}

                <TabsContent
                  value="block"
                  className="admin-integrity-tabs__content"
                >
                  <IntegrityDetailRow
                    label="Blockchain Block"
                    value={selectedBlockIndex(
                      selected,
                      blockMap,
                    )}
                    mono
                  />

                  <IntegrityDetailRow
                    label="Anchored At"
                    value={formatDate(
                      selected.anchored_at,
                    )}
                  />

                  <div className="admin-integrity-detail">
                    <span className="admin-integrity-detail__label">
                      Document Hash
                    </span>

                    <p
                      className="admin-integrity-detail__hash"
                      title={
                        selected.sha256_hash
                      }
                    >
                      {
                        selected.sha256_hash
                      }
                    </p>
                  </div>


                  <div className="admin-integrity-detail">
                    <span className="admin-integrity-detail__label">
                      Blockchain Hash
                    </span>

                    <p
                      className="admin-integrity-detail__hash"
                      title={
                        selected.blockchain_hash ??
                        ""
                      }
                    >
                      {
                        selected.blockchain_hash ??
                        "—"
                      }
                    </p>
                  </div>


                  {selected.blockchain_block_id &&
                    blockMap.get(
                      selected.blockchain_block_id,
                    ) && (
                      <div className="admin-integrity-chain">

                        <div className="admin-integrity-chain__header">
                          <p className="admin-integrity-chain__title">
                            Chain Linkage
                          </p>

                          <span className="admin-integrity-chain__block">
                            #
                            {
                              blockMap.get(
                                selected.blockchain_block_id,
                              )!.block_index
                            }
                          </span>
                        </div>


                        <p className="admin-integrity-chain__label">
                          Previous Hash
                        </p>

                        <p
                          className="admin-integrity-chain__hash"
                          title={
                            blockMap.get(
                              selected.blockchain_block_id,
                            )!.previous_hash
                          }
                        >
                          {
                            blockMap.get(
                              selected.blockchain_block_id,
                            )!.previous_hash
                          }
                        </p>


                        <p className="admin-integrity-chain__label">
                          Block Hash
                        </p>

                        <p
                          className="admin-integrity-chain__hash"
                          title={
                            blockMap.get(
                              selected.blockchain_block_id,
                            )!.hash
                          }
                        >
                          {
                            blockMap.get(
                              selected.blockchain_block_id,
                            )!.hash
                          }
                        </p>

                      </div>
                    )}
                </TabsContent>
              </Tabs>
            </div>
          </AdminCard>
        )}
      </div>
    </AdminPage>
  );
}


/* ================================================================
   SUMMARY METRIC
   ================================================================ */

function IntegrityMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <div
      className={`admin-integrity-metric admin-integrity-metric--${tone}`}
    >
      <p className="admin-integrity-metric__value">
        {value.toLocaleString()}
      </p>

      <p className="admin-integrity-metric__label">
        {label}
      </p>
    </div>
  );
}


/* ================================================================
   DETAIL ROW
   ================================================================ */

function IntegrityDetailRow({
  label,
  value,
  mono = false,
  status,
}: {
  label: string;
  value: string;
  mono?: boolean;
  status?: "success" | "warning";
}) {
  return (
    <div className="admin-integrity-detail">
      <span className="admin-integrity-detail__label">
        {label}
      </span>

      {status ? (
        <span
          className={`admin-integrity-detail__status admin-integrity-detail__status--${status}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {value}
        </span>
      ) : (
        <span
          className={`admin-integrity-detail__value ${
            mono
              ? "admin-integrity-detail__value--mono"
              : ""
          }`}
        >
          {value}
        </span>
      )}
    </div>
  );
}


/* ================================================================
   BLOCK INDEX
   ================================================================ */

function selectedBlockIndex(
  record: AdminDocumentIntegrity,
  blockMap: Map<
    string,
    AdminBlockchainBlock
  >,
): string {
  if (
    !record.blockchain_block_id
  ) {
    return "—";
  }

  const block =
    blockMap.get(
      record.blockchain_block_id,
    );

  return block
    ? `#${block.block_index}`
    : "—";
}