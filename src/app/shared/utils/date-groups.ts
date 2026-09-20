/** Buckets a timestamp into "Today" / "Yesterday" / a short date label, for grouped list UIs. */
export function dateGroupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function groupByDate<T extends { createdAt: string }>(items: T[]): { label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = dateGroupLabel(item.createdAt);
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
