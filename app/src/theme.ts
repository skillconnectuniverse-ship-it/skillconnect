import { BookingStatus, PlanKey, StatusKey } from './types';

export const colors = {
  primary: '#5b4bff',
  primaryDark: '#4536d6',
  bg: '#f6f7fb',
  card: '#ffffff',
  text: '#14151f',
  muted: '#6b7280',
  border: '#e5e7eb',
  danger: '#dc2626',
  success: '#16a34a',
  star: '#f59e0b',
};

export const STATUS: Record<StatusKey, { label: string; color: string; hint: string }> = {
  available: { label: 'Available', color: '#22c55e', hint: 'Ready to take work' },
  unavailable: { label: 'Unavailable', color: '#ef4444', hint: 'Not taking work' },
  dnd: { label: 'Do not disturb', color: '#b91c1c', hint: 'Do not contact me' },
  brb: { label: 'Be right back', color: '#f59e0b', hint: 'Back shortly' },
  away: { label: 'Appear away', color: '#eab308', hint: 'Away for a while' },
  offline: { label: 'Appear offline', color: '#9ca3af', hint: 'Hidden from others' },
};

export const STATUS_ORDER: StatusKey[] = ['available', 'unavailable', 'dnd', 'brb', 'away', 'offline'];

// Mirrors the backend rule for who can be hired.
export const HIREABLE: StatusKey[] = ['available', 'brb', 'away'];

export const PLANS: { key: PlanKey; label: string; unit: string }[] = [
  { key: 'hourly', label: 'Hourly', unit: 'hour' },
  { key: 'daily', label: 'Daily', unit: 'day' },
  { key: 'monthly', label: 'Monthly', unit: 'month' },
  { key: 'yearly', label: 'Yearly', unit: 'year' },
];

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD'];

export const BOOKING_BADGE: Record<BookingStatus, { label: string; color: string }> = {
  pending_payment: { label: 'Payment pending', color: '#f59e0b' },
  confirmed: { label: 'Confirmed', color: '#3b82f6' },
  in_progress: { label: 'In progress', color: '#8b5cf6' },
  completed: { label: 'Completed', color: '#16a34a' },
  cancelled: { label: 'Cancelled', color: '#9ca3af' },
};
