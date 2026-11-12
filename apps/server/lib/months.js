// Whether `text` is a month written "YYYY-MM"
export const isMonth = (text) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(text));

// The UTC month of `date`, as "YYYY-MM"
export const monthKey = (date) => new Date(date).toISOString().slice(0, 7);

// The month's first moment and the next month's first moment (UTC)
export function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  return [new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(y, m, 1))];
}

// The month `n` months after `month`
export function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(Date.UTC(y, m - 1 + n, 1)));
}
