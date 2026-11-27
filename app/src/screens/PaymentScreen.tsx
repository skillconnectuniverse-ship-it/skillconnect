import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { api } from '../api';
import { RootStackParamList, useNav } from '../nav';
import { colors } from '../theme';
import { Button, Card, confirmAction, Loading, showAlert } from '../ui';
import { Booking, Gateway } from '../types';
import { formatMoney, openExternal, planLabel } from '../utils';
import PaymentWebView from './PaymentWebView';

const ICON: Record<Gateway['id'], 'qr-code' | 'card' | 'flask'> = { razorpay: 'qr-code', stripe: 'card', demo: 'flask' };

export default function PaymentScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'Payment'>>();
  const nav = useNav();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [webUrl, setWebUrl] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [b, g] = await Promise.all([
          api.get<{ booking: Booking }>(`/bookings/${params.bookingId}`),
          api.get<{ gateways: Gateway[] }>('/payments/gateways', { bookingId: params.bookingId }),
        ]);
        setBooking(b.booking);
        setGateways(g.gateways);
      } catch (e) {
        showAlert('Could not load payment', (e as Error).message);
        nav.goBack();
      }
    })();
  }, [params.bookingId, nav]);

  const onPaid = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setWebUrl(null);
    nav.replace('BookingDetail', { bookingId: params.bookingId });
  }, [nav, params.bookingId]);

  // The server confirms payments (webhook/callback); the app just waits for that.
  useEffect(() => {
    if (!paymentId) return;
    const t = setInterval(async () => {
      try {
        const { status } = await api.get<{ status: string }>(`/payments/${paymentId}/status`);
        if (status === 'paid') onPaid();
      } catch {
        /* retry on next tick */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [paymentId, onPaid]);

  const pay = async (g: Gateway) => {
    setBusy(g.id);
    try {
      const r = await api.post<{ paymentId: string; url: string }>('/payments/checkout', { bookingId: params.bookingId, gateway: g.id });
      setPaymentId(r.paymentId);
      if (Platform.OS === 'web') {
        await openExternal(r.url);
        setWaiting(true);
      } else {
        setWebUrl(r.url);
      }
    } catch (e) {
      showAlert('Payment could not start', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!(await confirmAction('Cancel booking', 'Do you want to cancel this booking?'))) return;
    await api.post(`/bookings/${params.bookingId}/cancel`, {});
    nav.popToTop();
  };

  if (!booking) return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      <Card>
        <Text style={{ color: colors.muted }}>You are hiring</Text>
        <Text style={{ fontSize: 18, fontWeight: '800' }}>{booking.provider.name}</Text>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>
          {booking.skill.name} · {planLabel(booking.plan, booking.quantity)}
        </Text>
        <Text style={{ fontSize: 30, fontWeight: '900', marginTop: 10 }}>{formatMoney(booking.amountMinor, booking.currency)}</Text>
      </Card>

      <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Pay securely</Text>
      {gateways.length ? (
        gateways.map((g) => (
          <Button key={g.id} title={g.label} icon={ICON[g.id]} onPress={() => pay(g)} loading={busy === g.id} variant={g.id === 'demo' ? 'outline' : 'primary'} style={{ marginBottom: 10 }} />
        ))
      ) : (
        <Text style={{ color: colors.danger }}>No payment method is available for {booking.currency} yet.</Text>
      )}

      {waiting ? (
        <Card style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: '700' }}>Waiting for payment...</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>Complete the payment in the new tab. This page updates automatically once it succeeds.</Text>
        </Card>
      ) : null}

      <Button title="Cancel booking" variant="outline" onPress={cancel} style={{ marginTop: 16 }} />

      <PaymentWebView url={webUrl} onPaid={onPaid} onClose={() => setWebUrl(null)} />
    </ScrollView>
  );
}
