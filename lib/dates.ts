export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartIso(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export function dueDateForMonth(periodStart: string, dueDay: number): string {
  const [year, month] = periodStart.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, dueDay)).toISOString().slice(0, 10);
}

export function monthLabel(periodStart: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${periodStart}T00:00:00Z`));
}
