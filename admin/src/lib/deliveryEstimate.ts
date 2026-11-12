export type DeliveryOption = {
  value: string;
  label: string;
  days: number;
  /** When set, ETA uses calendar days (e.g. months) instead of business days. */
  calendarDays?: number;
};

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  // Bagz: in-stock items go out same day in Kampala; upcountry depends on distance (shop shows both).
  { value: "0", label: "Same-day in Kampala (in stock)", days: 0 },
  { value: "2", label: "2 business days", days: 2 },
  { value: "3", label: "3 business days", days: 3 },
  { value: "5", label: "5 business days", days: 5 },
  { value: "7", label: "1 week", days: 7 },
  { value: "14", label: "2 weeks", days: 14 },
  { value: "30", label: "1 month", days: 30, calendarDays: 30 },
  { value: "60", label: "2 months", days: 60, calendarDays: 60 },
  { value: "90", label: "3 months", days: 90, calendarDays: 90 }
];

export function optionByValue(value: string): DeliveryOption | undefined {
  return DELIVERY_OPTIONS.find((o) => o.value === value);
}

/** Add N business days (Mon–Fri) from a start date. */
export function addBusinessDays(from: Date, businessDays: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

export function deliveryTimestamps(days: number): { deliveryStartAt: number; deliveryEndAt: number } {
  const start = addBusinessDays(new Date(), days);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  return { deliveryStartAt: startMs, deliveryEndAt: end.getTime() };
}

function deliveryTimestampsCalendar(calendarDays: number): {
  deliveryStartAt: number;
  deliveryEndAt: number;
} {
  const start = new Date();
  start.setDate(start.getDate() + calendarDays);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  return { deliveryStartAt: startMs, deliveryEndAt: end.getTime() };
}

export function deliveryFieldsFromSelection(value: string) {
  const opt = optionByValue(value);
  if (!opt) {
    return {
      deliveryEstimateDays: null as number | null,
      deliveryEstimateLabel: null as string | null,
      deliveryStartAt: null as number | null,
      deliveryEndAt: null as number | null
    };
  }
  const { deliveryStartAt, deliveryEndAt } =
    opt.calendarDays != null
      ? deliveryTimestampsCalendar(opt.calendarDays)
      : deliveryTimestamps(opt.days);
  return {
    deliveryEstimateDays: opt.days,
    deliveryEstimateLabel: opt.label,
    deliveryStartAt,
    deliveryEndAt
  };
}
