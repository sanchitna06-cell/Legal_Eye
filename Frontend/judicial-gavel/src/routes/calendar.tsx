import { createFileRoute, redirect } from '@tanstack/react-router'
import { Trash2 } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getYear,
  isSameDay,
  isSameMonth,
  isToday,
  setMonth,
  setYear,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { SidebarDrawer } from "@/components/dashboard/SidebarDrawer";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  getCases,
  type BackendCase,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/api";
import { getSession } from "@/lib/user-store";

export const Route = createFileRoute("/calendar")({
  beforeLoad: () => {
    if (!getSession()) {
      throw redirect({ to: "/" });
    }
  },

  head: () => ({
    meta: [
      { title: "Legal Calendar — JURY HASH" },
      {
        name: "description",
        content:
          "Hearings, filing deadlines, client meetings and other legal events.",
      },
    ],
  }),

  component: Calendar,
});

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const MONTHS_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

const CALENDAR_INPUT_CLASS = "w-full px-3.5 py-3 outline-none transition-all";

const EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  HEARING: "Hearing",
  FILING_DEADLINE: "Filing deadline",
  CLIENT_MEETING: "Client meeting",
  COURT_APPEARANCE: "Court appearance",
  REMINDER: "Reminder",
  OTHER: "Other",
};

const EVENT_TYPE_TONE: Record<CalendarEventType, string> = {
  HEARING: "calendar-event-hearing",
  FILING_DEADLINE: "calendar-event-deadline",
  CLIENT_MEETING: "calendar-event-meeting",
  COURT_APPEARANCE: "calendar-event-court",
  REMINDER: "calendar-event-reminder",
  OTHER: "calendar-event-other",
};

const EVENT_TYPE_SWATCH: Record<CalendarEventType, string> = {
  HEARING: "calendar-swatch-hearing",
  FILING_DEADLINE: "calendar-swatch-deadline",
  CLIENT_MEETING: "calendar-swatch-meeting",
  COURT_APPEARANCE: "calendar-swatch-court",
  REMINDER: "calendar-swatch-reminder",
  OTHER: "calendar-swatch-other",
};

const LEGEND_ITEMS: { type: CalendarEventType; label: string }[] = [
  { type: "HEARING", label: "Hearing" },
  { type: "FILING_DEADLINE", label: "Deadline" },
  { type: "CLIENT_MEETING", label: "Meeting" },
  { type: "COURT_APPEARANCE", label: "Court" },
  { type: "REMINDER", label: "Reminder" },
  { type: "OTHER", label: "Other" },
];

/**
 * Roving-focus keyboard navigation for the picker chip grids.
 * `columns` is the grid column count; ArrowLeft/Right always move by one,
 * ArrowUp/Down by one row, Home/End jump within the row.
 */
function moveGridFocus(event: ReactKeyboardEvent<HTMLElement>, columns: number) {
  const container = event.currentTarget;
  const items = Array.from(
    container.querySelectorAll<HTMLElement>("[data-roving]"),
  );
  const currentIndex = items.indexOf(event.target as HTMLElement);

  if (currentIndex === -1) {
    return;
  }

  let next: number | null = null;

  switch (event.key) {
    case "ArrowRight":
      next = currentIndex + 1;
      break;
    case "ArrowLeft":
      next = currentIndex - 1;
      break;
    case "ArrowDown":
      next = columns === 1 ? null : currentIndex + columns;
      break;
    case "ArrowUp":
      next = columns === 1 ? null : currentIndex - columns;
      break;
    case "Home":
      next = currentIndex - (currentIndex % columns);
      break;
    case "End":
      next = currentIndex + (columns - 1 - (currentIndex % columns));
      break;
    default:
      return;
  }

  if (next === null) {
    return;
  }

  event.preventDefault();
  items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
}

function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(new Date()),
  );

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);

  const [cases, setCases] = useState<BackendCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);

  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] =
    useState<CalendarEventType>("HEARING");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState("60");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Date navigation popover state.
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [browseMonth, setBrowseMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [deleteConfirmEvent, setDeleteConfirmEvent] =
    useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);

  const datePickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const datePickerPanelRef = useRef<HTMLDivElement | null>(null);

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(currentMonth)),
      end: endOfWeek(endOfMonth(currentMonth)),
    });
  }, [currentMonth]);

  const pickerDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(browseMonth)),
      end: endOfWeek(endOfMonth(browseMonth)),
    });
  }, [browseMonth]);

  const pickerYears = useMemo(() => {
    const year = browseMonth.getFullYear();

    return [year - 3, year - 2, year - 1, year, year + 1, year + 2, year + 3];
  }, [browseMonth]);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError(null);

      try {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);

        const result = await getCalendarEvents(
          format(monthStart, "yyyy-MM-dd'T'HH:mm:ss"),
          format(monthEnd, "yyyy-MM-dd'T'HH:mm:ss"),
        );

        if (!cancelled) {
          setEvents(result);
        }
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load calendar events.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [currentMonth]);

  // Close the date picker on Escape / click outside / focus leaving it.
  useEffect(() => {
    if (!datePickerOpen) {
      return;
    }

    datePickerPanelRef.current?.focus();

    function closeDatePicker(refocusTrigger: boolean) {
      setDatePickerOpen(false);

      if (refocusTrigger) {
        datePickerTriggerRef.current?.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        datePickerPanelRef.current?.contains(target) ||
        datePickerTriggerRef.current?.contains(target)
      ) {
        return;
      }

      closeDatePicker(false);
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeDatePicker(true);
      }
    }

    function onFocusOut(event: FocusEvent) {
      const nextTarget = event.relatedTarget as Node | null;

      if (!nextTarget) {
        return;
      }

      if (
        datePickerPanelRef.current?.contains(nextTarget) ||
        datePickerTriggerRef.current?.contains(nextTarget)
      ) {
        return;
      }

      closeDatePicker(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [datePickerOpen]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const key = format(new Date(event.start_at), "yyyy-MM-dd");
      const existing = map.get(key);

      if (existing) {
        existing.push(event);
      } else {
        map.set(key, [event]);
      }
    }

    return map;
  }, [events]);

  const monthEventCount = events.length;

  const nextEvent = useMemo(() => {
    const now = Date.now();

    return [...events]
      .filter((event) => new Date(event.start_at).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      )[0];
  }, [events]);

  function openCreateEventModal(date = new Date()) {
    setEventTitle("");
    setEventType("HEARING");
    setEventDate(format(date, "yyyy-MM-dd"));
    setStartTime("10:00");
    setEndTime("11:00");
    setEventDescription("");
    setAllDay(false);
    setReminderMinutes("60");
    setSelectedCaseId("");
    setFormError(null);
    setEventModalOpen(true);

    if (cases.length === 0) {
      setCasesLoading(true);

      void getCases()
        .then(setCases)
        .catch(() => {
          setCases([]);
        })
        .finally(() => {
          setCasesLoading(false);
        });
    }
  }

  async function handleCreateEvent() {
    setFormError(null);

    if (!eventTitle.trim()) {
      setFormError("Event title is required.");
      return;
    }

    if (!eventDate) {
      setFormError("Event date is required.");
      return;
    }

    if (!allDay && !startTime) {
      setFormError("Start time is required.");
      return;
    }

    const startAt = allDay
      ? `${eventDate}T00:00:00`
      : `${eventDate}T${startTime}:00`;

    const endAt =
      allDay || !endTime ? null : `${eventDate}T${endTime}:00`;

    if (endAt && endAt <= startAt) {
      setFormError("End time must be after start time.");
      return;
    }

    try {
      setCreatingEvent(true);

      const created = await createCalendarEvent({
        title: eventTitle.trim(),
        description: eventDescription.trim() || null,
        event_type: eventType,
        start_at: startAt,
        end_at: endAt,
        all_day: allDay,
        reminder_minutes: reminderMinutes
          ? Number(reminderMinutes)
          : null,
        case_id: selectedCaseId || null,
      });

      setEvents((current) =>
        [...current, created].sort(
          (a, b) =>
            new Date(a.start_at).getTime() -
            new Date(b.start_at).getTime(),
        ),
      );

      setEventModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to create calendar event.",
      );
    } finally {
      setCreatingEvent(false);
    }
  }
  async function handleDeleteEvent() {
  if (!deleteConfirmEvent) {
    return;
  }

  setDeletingEvent(true);
  setError(null);

  try {
    await deleteCalendarEvent(deleteConfirmEvent.id);

    setEvents((current) =>
      current.filter((event) => event.id !== deleteConfirmEvent.id),
    );

    setSelectedEventId(null);
    setDeleteConfirmEvent(null);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to delete calendar event.",
    );
  } finally {
    setDeletingEvent(false);
  }
}
  function previousMonth() {
    setCurrentMonth((month) => subMonths(month, 1));
  }

  function nextMonth() {
    setCurrentMonth((month) => addMonths(month, 1));
  }

  function goToToday() {
    const now = new Date();

    setCurrentMonth(startOfMonth(now));
    setSelectedDate(now);
  }

  function toggleDatePicker() {
    setDatePickerOpen((open) => {
      if (!open) {
        setBrowseMonth(currentMonth);
      }

      return !open;
    });
  }

  function commitPickerDay(date: Date) {
    setCurrentMonth(startOfMonth(date));
    setSelectedDate(date);
    setDatePickerOpen(false);
    datePickerTriggerRef.current?.focus();
  }

  function commitPickerMonth(monthIndex: number) {
    setCurrentMonth((month) => startOfMonth(setMonth(month, monthIndex)));
    setBrowseMonth((month) => setMonth(month, monthIndex));
  }

  function commitPickerYear(year: number) {
    setCurrentMonth((month) => startOfMonth(setYear(month, year)));
    setBrowseMonth((month) => setYear(month, year));
  }

  function browseByYear(delta: number) {
    setBrowseMonth((month) => setYear(month, getYear(month) + delta));
  }

  const displayedSelectedDate = selectedDate ?? new Date();

  return (
    <div className="calendar-page min-h-screen bg-background">
      <SidebarDrawer
        expanded={sidebarExpanded}
        mobileOpen={mobileDrawerOpen}
        onToggle={() => setSidebarExpanded((value) => !value)}
        onMobileClose={() => setMobileDrawerOpen(false)}
        onSelectCategory={() => {}}
        activeCategory={null}
      />

      <AppHeader
        onMenu={() => setMobileDrawerOpen(true)}
        menuOpen={mobileDrawerOpen}
      />

      <div
        className={`transition-[padding-left] duration-300 ease-out ${
          sidebarExpanded ? "md:pl-80" : "md:pl-16"
        }`}
      >
        <main className="mx-auto max-w-[1500px] px-4 pb-20 sm:px-6 lg:px-8">
          {/* Page header */}
          <header className="pt-20 sm:pt-12">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="calendar-kicker flex items-center gap-2 font-mono font-semibold uppercase">
                  <CalendarDays className="h-3.5 w-3.5" />
                  JURY HASH · MATTER SCHEDULE
                </div>

                <h1 className="calendar-page-title mt-3 font-display leading-[0.95]">
                  Legal Calendar
                </h1>

                <p className="calendar-page-subtitle mt-4 max-w-2xl leading-relaxed">
                  Keep hearings, filing deadlines, client meetings and court
                  appearances in one controlled schedule.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openCreateEventModal()}
                className="calendar-add-event focus-legal group inline-flex w-fit items-center gap-2 self-start border px-4 py-3 font-mono font-bold uppercase transition-all hover:-translate-y-0.5 xl:self-auto"
              >
                <Plus className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
                Add event
              </button>
            </div>

            <div className="mt-8 h-px w-full rule-brass" />
          </header>

          {/* Summary strip */}
          <section className="calendar-summary mt-6 grid gap-px overflow-hidden border sm:grid-cols-3">
            <SummaryStat
              eyebrow="This month"
              value={String(monthEventCount).padStart(2, "0")}
              label={monthEventCount === 1 ? "scheduled event" : "scheduled events"}
            />

            <SummaryStat
              eyebrow="Next appearance"
              value={
                nextEvent
                  ? format(new Date(nextEvent.start_at), "dd MMM")
                  : "—"
              }
              label={
                nextEvent
                  ? `${EVENT_TYPE_LABEL[nextEvent.event_type]} · ${format(
                      new Date(nextEvent.start_at),
                      "HH:mm",
                    )}`
                  : "No upcoming events"
              }
            />

            <SummaryStat
              eyebrow="Calendar status"
              value={loading ? "SYNC" : "LIVE"}
              label={loading ? "Refreshing schedule" : "Backend schedule connected"}
            />
          </section>

          {/* Calendar shell */}
          <section className="calendar-shell mt-6 overflow-hidden border shadow-[0_20px_60px_-35px_rgba(0,0,0,0.45)]">
            <div className="calendar-toolbar flex flex-col border-b lg:flex-row lg:items-stretch lg:justify-between">
              <div className="calendar-toolbar-group flex items-center gap-2 border-b px-3 py-3 lg:border-b-0 lg:border-r">
                <button
                  type="button"
                  onClick={previousMonth}
                  aria-label="Previous month"
                  className="calendar-nav-button focus-legal inline-flex h-9 w-9 items-center justify-center border transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Next month"
                  className="calendar-nav-button focus-legal inline-flex h-9 w-9 items-center justify-center border transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={goToToday}
                  className="calendar-today-button focus-legal ml-1 border px-3 py-2 font-mono font-bold uppercase transition-all"
                >
                  Today
                </button>
              </div>

              <div className="calendar-month-heading relative flex flex-1 flex-col gap-2.5 border-b px-4 py-3 lg:border-b-0 lg:border-r sm:px-5">
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                  <div>
                    <p className="font-mono text-[9px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                      Current view
                    </p>

                    <h2 className="mt-0.5">
                      <button
                        ref={datePickerTriggerRef}
                        type="button"
                        onClick={toggleDatePicker}
                        aria-haspopup="dialog"
                        aria-expanded={datePickerOpen}
                        aria-controls="calendar-date-picker"
                        aria-label={`${format(
                          currentMonth,
                          "MMMM yyyy",
                        )} — open date navigation`}
                        className="calendar-month-trigger focus-legal"
                      >
                        <span className="calendar-month-title font-display sm:text-3xl">
                          {format(currentMonth, "MMMM yyyy")}
                        </span>
                        <ChevronDown
                          className="calendar-month-trigger-chevron"
                          aria-hidden="true"
                        />
                      </button>
                    </h2>
                  </div>

                  <div className="calendar-legend hidden flex-wrap items-center gap-x-3.5 gap-y-1.5 sm:flex">
                    {LEGEND_ITEMS.map((item) => (
                      <LegendItem
                        key={item.type}
                        label={item.label}
                        swatch={EVENT_TYPE_SWATCH[item.type]}
                      />
                    ))}
                  </div>
                </div>

                {datePickerOpen && (
                  <div
                    ref={datePickerPanelRef}
                    id="calendar-date-picker"
                    role="dialog"
                    aria-label="Jump to date"
                    tabIndex={-1}
                    className="calendar-date-picker absolute left-4 top-full z-40 mt-1.5 w-[320px] max-w-[calc(100vw-3.5rem)] outline-none sm:left-5"
                  >
                    <div className="calendar-dp-head">
                      <button
                        type="button"
                        onClick={() => browseByYear(-1)}
                        aria-label="Previous year"
                        className="calendar-dp-arrow focus-legal"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>

                      <span className="calendar-dp-year-label font-display">
                        {format(browseMonth, "yyyy")}
                      </span>

                      <button
                        type="button"
                        onClick={() => browseByYear(1)}
                        aria-label="Next year"
                        className="calendar-dp-arrow focus-legal"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div
                      className="calendar-dp-years"
                      onKeyDown={(event) => moveGridFocus(event, 1)}
                    >
                      {pickerYears.map((year) => (
                        <button
                          key={year}
                          type="button"
                          data-roving
                          onClick={() => commitPickerYear(year)}
                          aria-pressed={getYear(browseMonth) === year}
                          className={`calendar-dp-year focus-legal ${
                            getYear(browseMonth) === year ? "is-active" : ""
                          }`}
                        >
                          {year}
                        </button>
                      ))}
                    </div>

                    <div
                      className="calendar-dp-months"
                      onKeyDown={(event) => moveGridFocus(event, 4)}
                    >
                      {MONTHS_SHORT.map((month, index) => (
                        <button
                          key={month}
                          type="button"
                          data-roving
                          onClick={() => commitPickerMonth(index)}
                          aria-pressed={browseMonth.getMonth() === index}
                          className={`calendar-dp-month focus-legal ${
                            browseMonth.getMonth() === index ? "is-active" : ""
                          }`}
                        >
                          {month}
                        </button>
                      ))}
                    </div>

                    <div className="calendar-dp-days">
                      <p className="calendar-dp-days-label font-mono">
                        {format(browseMonth, "MMMM yyyy")}
                      </p>

                      <div
                        className="calendar-dp-weekdays"
                        aria-hidden="true"
                      >
                        {WEEKDAY_LETTERS.map((letter, index) => (
                          <span key={`${letter}-${index}`} className="calendar-dp-weekday font-mono">
                            {letter}
                          </span>
                        ))}
                      </div>

                      <div
                        className="calendar-dp-grid"
                        onKeyDown={(event) => moveGridFocus(event, 7)}
                      >
                        {pickerDays.map((day) => {
                          const dayKey = format(day, "yyyy-MM-dd");
                          const outside = !isSameMonth(day, browseMonth);
                          const dayIsToday = isToday(day);
                          const dayIsSelected =
                            selectedDate !== null && isSameDay(day, selectedDate);

                          return (
                            <button
                              key={dayKey}
                              type="button"
                              data-roving
                              onClick={() => commitPickerDay(day)}
                              aria-pressed={dayIsSelected}
                              aria-label={format(day, "EEEE, MMMM d, yyyy")}
                              className={`calendar-dp-day focus-legal ${
                                outside ? "is-outside" : ""
                              } ${dayIsToday ? "is-today" : ""} ${
                                dayIsSelected ? "is-selected" : ""
                              }`}
                            >
                              {format(day, "d")}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="calendar-dp-footer">
                      <span className="calendar-dp-selected font-mono">
                        Selected{" "}
                        <strong>{format(displayedSelectedDate, "MMM d")}</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          goToToday();
                          setDatePickerOpen(false);
                          datePickerTriggerRef.current?.focus();
                        }}
                        className="calendar-dp-today-btn focus-legal"
                      >
                        Go to today
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="calendar-schedule-count flex items-center justify-between gap-3 px-4 py-3 text-right sm:px-5">
                <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                  Schedule
                </p>
                <p className="mt-0.5 font-mono text-xs font-semibold text-brass">
                  {loading
                    ? "SYNCING…"
                    : `${String(monthEventCount).padStart(2, "0")} EVENTS`}
                </p>
              </div>
            </div>

            {error && (
              <div className="calendar-error border-b px-4 py-3 font-mono leading-relaxed">
                <span className="font-bold uppercase">Schedule error:</span>{" "}
                {error}
              </div>
            )}

            {/* Weekday header + month grid (horizontally scrollable on narrow screens) */}
            <div className="calendar-scroll overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="calendar-weekdays grid grid-cols-7 border-b">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="calendar-weekday border-r px-2 py-2.5 text-center font-mono font-bold last:border-r-0 sm:py-3"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="calendar-grid grid grid-cols-7">
                  {calendarDays.map((day, index) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayEvents = eventsByDay.get(key) ?? [];
                    const currentMonthDay = isSameMonth(day, currentMonth);
                    const today = isToday(day);
                    const selected =
                      selectedDate !== null && isSameDay(day, selectedDate);
                    const weekend = day.getDay() === 0 || day.getDay() === 6;
                    const isLastRow = index >= calendarDays.length - 7;
                    const isLastColumn = index % 7 === 6;

                    return (
                      <div
                        key={key}
                        onDoubleClick={() => openCreateEventModal(day)}
                        className={`calendar-day-cell group relative min-h-[136px] cursor-default border-r border-b p-2.5 transition-colors sm:min-h-[152px] sm:p-3 ${
                          isLastColumn ? "border-r-0" : ""
                        } ${isLastRow ? "border-b-0" : ""} ${
                          currentMonthDay
                            ? weekend
                              ? "calendar-day-weekend"
                              : "calendar-day-current"
                            : "calendar-day-outside"
                        } ${today ? "calendar-day-today" : ""}`}
                        title="Double-click to add an event on this date"
                      >
                        <div className="flex items-start justify-between">
                          <button
                            type="button"
                            onClick={() => setSelectedDate(day)}
                            aria-pressed={selected}
                            aria-label={`Select ${format(day, "EEEE, MMMM d, yyyy")}`}
                            className={`calendar-day-number focus-legal ${
                              today ? "calendar-day-number-today" : ""
                            } ${
                              selected && !today
                                ? "calendar-day-number-selected"
                                : ""
                            } ${
                              !currentMonthDay ? "calendar-day-number-outside" : ""
                            }`}
                          >
                            {format(day, "d")}
                          </button>

                          {dayEvents.length > 0 && (
                            <span className="calendar-event-count font-mono font-bold tracking-wider">
                              {String(dayEvents.length).padStart(2, "0")}
                            </span>
                          )}
                        </div>

                        <div className="calendar-events mt-2.5 space-y-1.5">
                          {dayEvents.slice(0, 3).map((event) => (
                            <CalendarEventChip
                              key={event.id}
                              event={event}
                              selected={event.id === selectedEventId}
                              onToggle={() =>
                                setSelectedEventId((id) =>
                                  id === event.id ? null : event.id,
                                )
                              }
                              onDelete={() => setDeleteConfirmEvent(event)}

                            />
                          ))}

                          {dayEvents.length > 3 && (
                            <div className="calendar-more px-1 pt-0.5 font-mono font-bold tracking-[0.08em]">
                              +{dayEvents.length - 3} MORE
                            </div>
                          )}
                        </div>

                        {currentMonthDay && dayEvents.length === 0 && (
                          <button
                            type="button"
                            onClick={() => openCreateEventModal(day)}
                            aria-label={`Add event on ${format(day, "MMMM d, yyyy")}`}
                            className="calendar-add-day focus-legal absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-transparent opacity-0 transition-all focus-visible:opacity-100 group-hover:border-current group-hover:opacity-100"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <p className="calendar-hint mt-3 text-right font-mono tracking-[0.1em] uppercase">
            Double-click any date to create an event
          </p>
        </main>
      </div>

      {eventModalOpen && (
        <div
          className="calendar-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-event-title"
        >
          <div className="calendar-modal max-h-[92vh] w-full max-w-3xl overflow-y-auto border shadow-[0_30px_100px_-30px_rgba(0,0,0,0.7)]">
            <div className="calendar-modal-header flex items-start justify-between border-b px-5 py-5 sm:px-6">
              <div>
                <div className="calendar-modal-kicker flex items-center gap-2 font-mono font-bold uppercase">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Schedule entry
                </div>
                <h2
                  id="create-event-title"
                  className="calendar-modal-title mt-2 font-display"
                >
                  Add calendar event
                </h2>
                <p className="calendar-modal-subtitle mt-1.5">
                  Create a dated record for this matter schedule.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                disabled={creatingEvent}
                className="calendar-modal-close focus-legal inline-flex h-9 w-9 shrink-0 items-center justify-center border transition-colors disabled:opacity-50"
                aria-label="Close event dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="calendar-modal-body space-y-6 p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Event title" className="sm:col-span-2">
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={(event) => setEventTitle(event.target.value)}
                    placeholder="e.g. Supreme Court Hearing"
                    className={CALENDAR_INPUT_CLASS}
                    autoFocus
                  />
                </Field>

                <Field label="Event type">
                  <select
                    value={eventType}
                    onChange={(event) =>
                      setEventType(event.target.value as CalendarEventType)
                    }
                    className={CALENDAR_INPUT_CLASS}
                  >
                    <option value="HEARING">Hearing</option>
                    <option value="FILING_DEADLINE">Filing Deadline</option>
                    <option value="CLIENT_MEETING">Client Meeting</option>
                    <option value="COURT_APPEARANCE">Court Appearance</option>
                    <option value="REMINDER">Reminder</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>

                <Field label="Date">
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(event) => setEventDate(event.target.value)}
                    className={CALENDAR_INPUT_CLASS}
                  />
                </Field>

                <label className="calendar-all-day flex cursor-pointer items-center gap-3 border px-3.5 py-3.5 transition-colors sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(event) => setAllDay(event.target.checked)}
                    className="calendar-checkbox h-4 w-4"
                  />
                  <span>
                    <span className="calendar-all-day-title block font-semibold">
                      All-day event
                    </span>
                    <span className="calendar-all-day-help mt-0.5 block">
                      No start or end time will be stored.
                    </span>
                  </span>
                </label>

                {!allDay && (
                  <>
                    <Field label="Start time">
                      <div className="relative">
                        <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="time"
                          value={startTime}
                          onChange={(event) => setStartTime(event.target.value)}
                          className={`${CALENDAR_INPUT_CLASS} pl-9`}
                        />
                      </div>
                    </Field>

                    <Field label="End time">
                      <div className="relative">
                        <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="time"
                          value={endTime}
                          onChange={(event) => setEndTime(event.target.value)}
                          className={`${CALENDAR_INPUT_CLASS} pl-9`}
                        />
                      </div>
                    </Field>
                  </>
                )}

                <Field label="Case association">
                  <select
                    value={selectedCaseId}
                    onChange={(event) => setSelectedCaseId(event.target.value)}
                    disabled={casesLoading}
                    className={`calendar-input ${CALENDAR_INPUT_CLASS} disabled:cursor-wait disabled:opacity-50`}
                  >
                    <option value="">No case association</option>
                    {cases.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.case_number} — {item.title}
                      </option>
                    ))}
                  </select>
                  {casesLoading && (
                    <p className="calendar-loading-hint mt-1.5 font-mono tracking-wider">
                      Loading your matters…
                    </p>
                  )}
                </Field>

                <Field label="Reminder">
                  <select
                    value={reminderMinutes}
                    onChange={(event) =>
                      setReminderMinutes(event.target.value)
                    }
                    className={CALENDAR_INPUT_CLASS}
                  >
                    <option value="">No reminder</option>
                    <option value="15">15 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                    <option value="120">2 hours before</option>
                    <option value="1440">1 day before</option>
                  </select>
                </Field>

                <Field label="Description" className="sm:col-span-2">
                  <textarea
                    value={eventDescription}
                    onChange={(event) =>
                      setEventDescription(event.target.value)
                    }
                    rows={4}
                    placeholder="Courtroom, participants, filing notes or other relevant details…"
                    className={`${CALENDAR_INPUT_CLASS} min-h-28 resize-none`}
                  />
                </Field>
              </div>

              {formError && (
                <div className="calendar-form-error border px-3.5 py-3 font-mono leading-relaxed">
                  {formError}
                </div>
              )}
            </div>

            <div className="calendar-modal-footer flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                disabled={creatingEvent}
                className="calendar-cancel focus-legal border px-4 py-2.5 font-mono font-bold uppercase transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleCreateEvent()}
                disabled={creatingEvent}
                className="calendar-create-button focus-legal inline-flex items-center justify-center gap-2 border px-5 py-2.5 font-mono font-bold uppercase transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {creatingEvent ? "Creating…" : "Create event"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirmEvent && (
  <div
    className="calendar-modal-backdrop fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-md"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-event-title"
  >
    <div className="calendar-delete-modal w-full max-w-md border shadow-[0_30px_100px_-30px_rgba(0,0,0,0.7)]">
      <div className="calendar-delete-header border-b px-5 py-5 sm:px-6">
        <p className="calendar-modal-kicker font-mono font-bold uppercase">
          Schedule action
        </p>

        <h2
          id="delete-event-title"
          className="calendar-delete-title mt-2 font-display"
        >
          Delete event?
        </h2>

        <p className="calendar-delete-description mt-2">
          This will permanently remove this calendar event from your
          schedule.
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="calendar-delete-event">
          <p className="calendar-delete-event-type font-mono font-bold uppercase">
            {EVENT_TYPE_LABEL[deleteConfirmEvent.event_type]}
          </p>

          <p className="calendar-delete-event-title">
            {deleteConfirmEvent.title}
          </p>

          <p className="calendar-delete-event-time font-mono">
            {format(
              new Date(deleteConfirmEvent.start_at),
              "EEE, dd MMM yyyy · HH:mm",
            )}
          </p>
        </div>
      </div>

      <div className="calendar-modal-footer flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button
          type="button"
          onClick={() => setDeleteConfirmEvent(null)}
          disabled={deletingEvent}
          className="calendar-cancel focus-legal border px-4 py-2.5 font-mono font-bold uppercase transition-colors disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => void handleDeleteEvent()}
          disabled={deletingEvent}
          className="calendar-delete-confirm focus-legal inline-flex items-center justify-center gap-2 border px-5 py-2.5 font-mono font-bold uppercase transition-all disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />

          {deletingEvent ? "Deleting…" : "Delete event"}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

function SummaryStat({
  eyebrow,
  value,
  label,
}: {
  eyebrow: string;
  value: string;
  label: string;
}) {
  return (
    <div className="calendar-summary-stat px-5 py-4 sm:px-6">
      <p className="calendar-summary-eyebrow font-mono font-bold uppercase">
        {eyebrow}
      </p>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="calendar-summary-value font-display">{value}</span>
        <span className="calendar-summary-label truncate">
          {label}
        </span>
      </div>
    </div>
  );
}

function LegendItem({ label, swatch }: { label: string; swatch: string }) {
  return (
    <span className="calendar-legend calendar-legend-item inline-flex items-center font-mono uppercase">
      <span aria-hidden="true" className={`calendar-legend-swatch ${swatch}`} />
      {label}
    </span>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="calendar-field-label font-mono font-bold uppercase">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function CalendarEventChip({
  event,
  selected,
  onToggle,
  onDelete,
}: {
  event: CalendarEvent;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const start = new Date(event.start_at);

  const tone =
    EVENT_TYPE_TONE[event.event_type] ?? EVENT_TYPE_TONE.OTHER;

  const timeLabel = event.all_day
    ? "All day"
    : `${format(start, "HH:mm")}${
        event.end_at
          ? ` — ${format(new Date(event.end_at), "HH:mm")}`
          : ""
      }`;

  return (
    <div
      className={`calendar-event-chip-wrap relative ${
        selected ? "is-selected" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={`${EVENT_TYPE_LABEL[event.event_type]}: ${event.title}, ${timeLabel}`}
        title={`${event.title} · ${EVENT_TYPE_LABEL[event.event_type]} · ${timeLabel}`}
        className={`calendar-event-chip group/event focus-legal ${tone} ${
          selected ? "is-selected" : ""
        }`}
      >
        <span className="calendar-event-type font-mono font-bold tracking-[0.1em] uppercase">
          {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}
        </span>

        <span className="calendar-event-title mt-1 font-semibold">
          {event.title}
        </span>

        <span className="calendar-event-time mt-1.5 font-mono font-semibold">
          <Clock3
            className="h-2.5 w-2.5 shrink-0"
            aria-hidden="true"
          />
          {timeLabel}
        </span>
      </button>

      {selected && (
        <button
          type="button"
          className="calendar-event-delete focus-legal"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete ${event.title}`}
        title="Delete event"
        >
        <Trash2
          size={13}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        </button>
    )}
    </div>
  );
}