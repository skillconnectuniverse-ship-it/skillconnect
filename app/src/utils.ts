import { Linking, Platform } from 'react-native';
import { PLANS } from './theme';
import { PlanKey, Skill } from './types';

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

export function formatRate(amount: number, currency: string): string {
  return formatMoney(Math.round(amount * 100), currency);
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function planLabel(plan: PlanKey, quantity: number): string {
  const unit = PLANS.find((p) => p.key === plan)?.unit ?? plan;
  return `${quantity} ${unit}${quantity > 1 ? 's' : ''}`;
}

export function lowestRate(skill: Skill): { plan: PlanKey; amount: number } | null {
  const entries = (Object.entries(skill.rates) as [PlanKey, number][]).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  const order = PLANS.map((p) => p.key);
  entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  return { plan: entries[0][0], amount: entries[0][1] };
}

// Opens Google Maps turn-by-turn directions (app on phones, browser on web).
export function openDirections(lat: number, lng: number) {
  return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
}

export function callNumber(phone: string) {
  return Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

export function openExternal(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return Promise.resolve();
  }
  return Linking.openURL(url);
}
