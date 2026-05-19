export const DEFAULT_DATE_LOCALE = 'en-US';

export const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
};

const toDate = (value, { dateOnly = false } = {}) => {
  if (!value) return null;
  const normalizedValue =
    dateOnly && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00`
      : value;
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateOnly = (value, locale = DEFAULT_DATE_LOCALE) => {
  if (!value) return '';
  const date = toDate(value, { dateOnly: true });
  if (!date) return '';
  return date.toLocaleDateString(locale, { dateStyle: 'medium' });
};

export const formatDateTime = (value, locale = DEFAULT_DATE_LOCALE) => {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
};

export const formatCompactDateTime = (value, locale = DEFAULT_DATE_LOCALE) => {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
};

export const formatOpenEndedDateRange = (
  startValue,
  endValue,
  {
    locale = DEFAULT_DATE_LOCALE,
    startFallback = 'Now',
    endFallback = 'Indefinite',
  } = {}
) => {
  const startDate = toDate(startValue);
  const endDate = toDate(endValue);
  if (!startDate && !endDate) return '';

  const startLabel = startDate
    ? startDate.toLocaleDateString(locale, { dateStyle: 'medium' })
    : startFallback;
  const endLabel = endDate
    ? endDate.toLocaleDateString(locale, { dateStyle: 'medium' })
    : endFallback;

  return `${startLabel} - ${endLabel}`;
};
