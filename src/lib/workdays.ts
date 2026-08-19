export type WorkdayOverrides = Record<string, boolean>;

export function isDefaultWorkday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function isWorkday(date: Date, overrides: WorkdayOverrides): boolean {
  const key = localDateKey(date);
  return overrides[key] ?? isDefaultWorkday(date);
}

export function nextWorkday(fromDate: Date, overrides: WorkdayOverrides): Date {
  const date = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  do { date.setDate(date.getDate() + 1); } while (!isWorkday(date, overrides));
  return date;
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
