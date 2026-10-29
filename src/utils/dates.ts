export const toDateInputValue = (d?: string | null) => {
  if (!d) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.slice(0, 10);
  }
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return undefined;
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return undefined;
  }
};

/** Keep API calendar dates in YYYY-MM-DD form without local-time conversion. */
export const formatCalendarDate = (value?: string | null) => {
  if (!value) return '';
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})(?:$|T|\s)/);
  if (dateOnly) return dateOnly[1];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};
