import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  FileClock,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessagesSquare,
  PenLine,
  Send,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Document-analysis sidebar.
 *
 * This is NOT the dashboard sidebar: no pinned cases, no The Bar, no
 * archive. It carries only the two groups relevant to reading a document —
 * CASE INTELLIGENCE (navigation) and TOOLS (analysis features).
 *
 * The AI Assistant lives here, inside the sidebar — it is not a floating
 * panel and never covers the PDF. When selected, the sidebar body becomes
 * the assistant workspace.
 *
 * Collapse behaviour matches the existing JURY HASH sidebar: the column
 * retracts to a 4-rem icon rail and can be expanded again from the rail.
 */

const HIDE_COLLAPSED = "md:group-data-[collapsed=true]:hidden";

interface SidebarNavProps {
  expanded: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
  /** "tools" shows the analysis tool list; "assistant" swaps in the AI workspace. */
  assistantOpen: boolean;
  onAssistantToggle: () => void;
  /** Scrolls a right-panel section (or the annotations toolbar) into view. */
  onJumpToSection: (sectionId: string) => void;
}

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  active?: boolean;
}

const CASE_INTELLIGENCE: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { key: "records", label: "Case Records", icon: FileClock, to: "/records" },
  { key: "upload", label: "Upload Case", icon: Upload, to: "/upload" },
];

const SUGGESTED_QUESTIONS = [
  "Summarize this document",
  "Find key points",
  "Explain this section",
  "What are the risks?",
];

function AssistantPanel() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      {
        role: "assistant",
        text: "Document intelligence is not connected to the analysis service yet. This panel will answer from the processed document once the backend endpoint is live.",
      },
    ]);
    setDraft("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-4 py-4">
        <p className={HIDE_COLLAPSED}>
          <span className="text-[10px] font-bold tracking-[0.18em] text-brass uppercase">
            AI Assistant
          </span>
        </p>
        <p className={`mt-1 font-display text-lg leading-snug text-parchment ${HIDE_COLLAPSED}`}>
          Document intelligence
        </p>
        <p className={`mt-1 text-[11px] leading-relaxed text-muted-foreground ${HIDE_COLLAPSED}`}>
          Ask a question about this document. Answers cite pages from the file on record.
        </p>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className={`label-legal ${HIDE_COLLAPSED}`}>Suggested questions</p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className={`focus-legal group flex w-full items-center justify-between gap-2 border border-border bg-surface/50 px-3 py-2.5 text-left text-xs text-parchment/90 transition-colors hover:border-brass-dim hover:bg-surface ${HIDE_COLLAPSED}`}
              >
                {q}
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-brass-dim transition-colors group-hover:text-brass" />
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`border px-3 py-2.5 text-xs leading-relaxed ${
                m.role === "user"
                  ? "border-brass/40 bg-brass/[0.07] text-parchment"
                  : "border-border bg-surface/60 text-muted-foreground"
              }`}
            >
              <p
                className={`label-legal mb-1 text-[9px] ${m.role === "user" ? "!text-brass-dim" : ""}`}
              >
                {m.role === "user" ? "You" : "Document Assistant"}
              </p>
              {m.text}
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className={`border-t border-border p-3 ${HIDE_COLLAPSED}`}
      >
        <div className="flex items-stretch border border-input bg-background/60 focus-within:border-brass">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask something about this document..."
            aria-label="Ask the document assistant"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-parchment outline-none placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            aria-label="Send question"
            className="focus-legal flex w-10 items-center justify-center border-l border-input text-brass transition-colors hover:bg-brass hover:text-primary-foreground"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

export function DocumentSidebar({
  expanded,
  mobileOpen,
  onToggle,
  onMobileClose,
  assistantOpen,
  onAssistantToggle,
  onJumpToSection,
}: SidebarNavProps) {
  const rail = !expanded;

  const tools: NavItem[] = [
    {
      key: "timeline",
      label: "Case Timeline",
      icon: FileClock,
      onClick: () => onJumpToSection("case-timeline"),
    },
    {
      key: "inconsistencies",
      label: "Inconsistency Identifier",
      icon: ListChecks,
      onClick: () => onJumpToSection("inconsistency-identifier"),
    },
    {
      key: "assistant",
      label: "AI Assistant",
      icon: MessagesSquare,
      active: assistantOpen,
      onClick: onAssistantToggle,
    },
    {
      key: "annotations",
      label: "Annotations",
      icon: PenLine,
      onClick: () => onJumpToSection("annotations-layer"),
    },
  ];

  return (
    <>
      {/* Scrim — mobile drawer mode only; desktop uses the push layout. */}
      <div
        aria-hidden="true"
        onClick={onMobileClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        aria-label="Document analysis — navigation and analysis tools"
        data-collapsed={expanded ? "false" : "true"}
        className={`group fixed left-0 z-50 flex w-80 flex-col border-r border-border bg-background grain shadow-2xl shadow-black/40 transition-[width,transform,visibility] duration-300 ease-out md:shadow-none
          max-md:inset-y-0
          md:bottom-0 md:top-0
          ${rail ? "md:w-16" : ""}
          ${
            mobileOpen
              ? "max-md:translate-x-0"
              : "max-md:pointer-events-none max-md:invisible max-md:-translate-x-full"
          }`}
      >
        {/* Handle row — the only JURY HASH brand in the workspace chrome. */}
        <div
          className={`flex items-center justify-between border-b border-border px-5 py-4 ${
            rail ? "md:justify-center md:px-0" : ""
          }`}
        >
          <span className={`font-display text-base tracking-wide ${HIDE_COLLAPSED}`}>
            JURY<span className="text-brass">HASH</span>
          </span>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close sidebar"
            className="focus-legal flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface/60 hover:text-parchment md:hidden"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className="focus-legal hidden h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface/60 hover:text-parchment md:flex"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        </div>

        {assistantOpen ? (
          <AssistantPanel />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            <p
              className={`px-3 pt-5 text-[10px] font-bold tracking-[0.18em] text-muted-foreground/60 uppercase ${HIDE_COLLAPSED}`}
            >
              Case Intelligence
            </p>

            <nav aria-label="Case intelligence" className="mt-2">
              <ul className="space-y-0.5">
                {CASE_INTELLIGENCE.map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.to ?? "/dashboard"}
                      title={rail ? item.label : undefined}
                      className={`focus-legal flex items-center gap-3 px-3 py-2 text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:bg-surface/40 hover:text-parchment ${
                        rail ? "md:justify-center" : ""
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0 text-brass-dim" />
                      <span className={HIDE_COLLAPSED}>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="my-5 h-px bg-border" aria-hidden="true" />

            <p
              className={`px-3 text-[10px] font-bold tracking-[0.18em] text-muted-foreground/60 uppercase ${HIDE_COLLAPSED}`}
            >
              Tools
            </p>

            <nav aria-label="Analysis tools" className="mt-2">
              <ul className="space-y-0.5">
                {tools.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={item.onClick}
                      aria-pressed={item.active ? "true" : undefined}
                      title={rail ? item.label : undefined}
                      className={`focus-legal flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left text-[11px] font-bold tracking-[0.14em] uppercase transition-colors ${
                        item.active
                          ? "border-brass bg-surface/60 text-parchment"
                          : "border-transparent text-muted-foreground hover:border-brass-dim hover:bg-surface/40 hover:text-parchment"
                      } ${rail ? "md:justify-center" : ""}`}
                    >
                      <item.icon
                        className={`h-3.5 w-3.5 shrink-0 ${item.active ? "text-brass" : "text-brass-dim"}`}
                      />
                      <span className={HIDE_COLLAPSED}>{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {!rail && (
              <div className="mt-10 border border-border bg-surface/40 px-4 py-4">
                <p className="label-legal">Evidence handling</p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  The original PDF is retrieved through the secure API and rendered read-only.
                  Annotations are a separate evidence layer and never alter the file on record.
                </p>
              </div>
            )}
          </div>
        )}

        <div className={`border-t border-border px-5 py-3 ${HIDE_COLLAPSED}`}>
          <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground/70 uppercase">
            Document Workspace
          </p>
        </div>
      </aside>
    </>
  );
}
