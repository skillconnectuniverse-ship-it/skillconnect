import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { api } from '../api';
import { RootStackParamList, useNav } from '../nav';
import { BOOKING_BADGE, colors } from '../theme';
import { Avatar, Button, Card, confirmAction, Input, Loading, showAlert, Stars } from '../ui';
import { Booking } from '../types';
import { callNumber, formatDuration, formatMoney, openDirections, planLabel } from '../utils';
import { useSocketEvent } from '../realtime';

export default function BookingDetailScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'BookingDetail'>>();
  const nav = useNav();
  const [b, setB] = useState<Booking | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ booking: Booking }>(`/bookings/${params.bookingId}`);
      setB(r.booking);
    } catch (e) {
      showAlert('Could not load booking', (e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [params.bookingId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  useSocketEvent<{ bookingId: string }>('booking:update', (p) => {
    if (p.bookingId === params.bookingId) load();
  });

  useEffect(() => {
    if (b?.status !== 'in_progress') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [b?.status]);

  if (!b) return <Loading />;

  const isClient = b.role === 'client';
  const other = isClient ? b.provider : b.client;
  const badge = BOOKING_BADGE[b.status];
  const active = b.status === 'confirmed' || b.status === 'in_progress';

  const act = async (fn: () => Promise<{ booking: Booking } | unknown>, failTitle: string) => {
    setBusy(true);
    try {
      const r = (await fn()) as { booking?: Booking };
      if (r?.booking) setB(r.booking);
      else await load();
      setOtp('');
    } catch (e) {
      showAlert(failTitle, (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const msg = b.status === 'confirmed' ? 'Your payment will be refunded.' : 'This booking will be closed.';
    if (!(await confirmAction('Cancel booking', msg, 'Cancel booking'))) return;
    act(() => api.post(`/bookings/${b.id}/cancel`, {}), 'Could not cancel');
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, maxWidth: 600, width: '100%', alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>{b.skill.name}</Text>
          <View style={{ backgroundColor: badge.color + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ color: badge.color, fontWeight: '800', fontSize: 12 }}>{badge.label}</Text>
          </View>
        </View>
        <Text style={{ color: colors.muted, marginTop: 4 }}>{planLabel(b.plan, b.quantity)} · {formatMoney(b.amountMinor, b.currency)}</Text>
        {!isClient ? <Text style={{ color: colors.muted, fontSize: 12 }}>Your earning: {formatMoney(b.providerEarningMinor, b.currency)} (after platform fee)</Text> : null}
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Booked on {new Date(b.createdAt).toLocaleString()}</Text>
        {b.notes ? <Text style={{ marginTop: 8 }}>Note: {b.notes}</Text> : null}
      </Card>

      <Card>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>{isClient ? 'Hired person' : 'Hired by'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar uri={other.avatar} name={other.name} size={50} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 16 }}>{other.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Stars value={other.ratingAvg} />
              <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>{other.city}</Text>
            </View>
          </View>
        </View>
        {b.status !== 'pending_payment' ? (
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            {active && other.phone ? <Button title="Call" icon="call" variant="success" onPress={() => callNumber(other.phone!)} style={{ flex: 1, marginRight: 8 }} /> : null}
            <Button title="Message" icon="chatbubble" variant="outline" onPress={() => nav.navigate('Chat', { userId: other.id, name: other.name })} style={{ flex: 1 }} />
          </View>
        ) : null}
      </Card>

      {b.status !== 'pending_payment' && (b.address || b.coords) ? (
        <Card>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Work location</Text>
          {b.address ? <Text style={{ fontWeight: '600' }}>{b.address}</Text> : null}
          {b.coords ? (
            <Button
              title={isClient ? 'View on Google Maps' : 'Navigate with Google Maps'}
              icon="navigate"
              onPress={() => openDirections(b.coords!.lat, b.coords!.lng)}
              style={{ marginTop: 10 }}
            />
          ) : null}
        </Card>
      ) : null}

      {b.status === 'pending_payment' && isClient ? <Button title="Pay now" onPress={() => nav.navigate('Payment', { bookingId: b.id })} style={{ marginBottom: 12 }} /> : null}

      {b.status === 'in_progress' && b.startedAt ? (
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ color: colors.muted }}>Work in progress</Text>
          <Text style={{ fontSize: 36, fontWeight: '900', color: colors.primary, fontVariant: ['tabular-nums'] }}>{formatDuration(now - new Date(b.startedAt).getTime())}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Started {new Date(b.startedAt).toLocaleTimeString()}</Text>
        </Card>
      ) : null}

      {isClient && active ? (
        <Card style={{ alignItems: 'center', backgroundColor: colors.primary + '10' }}>
          <Text style={{ fontWeight: '700' }}>{b.status === 'confirmed' ? 'Start OTP' : 'Finish OTP'}</Text>
          <Text style={{ fontSize: 42, fontWeight: '900', letterSpacing: 10, color: colors.primary, marginVertical: 6 }}>{b.status === 'confirmed' ? b.startOtp : b.endOtp}</Text>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>
            {b.status === 'confirmed'
              ? `Share this OTP with ${other.name} when they reach you. The timer starts after they enter it.`
              : `Share this OTP with ${other.name} once the work is done to complete the booking.`}
          </Text>
        </Card>
      ) : null}

      {!isClient && active ? (
        <Card>
          <Text style={{ fontWeight: '800', marginBottom: 4 }}>{b.status === 'confirmed' ? 'Reached the location?' : 'Work finished?'}</Text>
          <Text style={{ color: colors.muted, marginBottom: 10 }}>Ask {other.name} for the {b.status === 'confirmed' ? 'start' : 'finish'} OTP shown in their app.</Text>
          <Input value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="4-digit OTP" maxLength={4} style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} />
          <Button
            title={b.status === 'confirmed' ? 'Start work' : 'Finish work'}
            loading={busy}
            disabled={otp.length !== 4}
            onPress={() => act(() => api.post(`/bookings/${b.id}/${b.status === 'confirmed' ? 'start' : 'complete'}`, { otp }), 'OTP not accepted')}
          />
        </Card>
      ) : null}

      {b.status === 'completed' ? (
        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>Booking completed</Text>
          {b.startedAt && b.endedAt ? (
            <Text style={{ color: colors.muted, marginTop: 4 }}>
              {new Date(b.startedAt).toLocaleString()} - {new Date(b.endedAt).toLocaleString()} ({formatDuration(new Date(b.endedAt).getTime() - new Date(b.startedAt).getTime())})
            </Text>
          ) : null}
          {isClient && !b.reviewed ? (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>Rate {other.name}</Text>
              <Stars value={rating} size={32} onChange={setRating} />
              <Input value={comment} onChangeText={setComment} multiline placeholder="Write a review (optional)" maxLength={1000} style={{ marginTop: 10 }} />
              <Button title="Submit review" loading={busy} onPress={() => act(() => api.post(`/bookings/${b.id}/review`, { rating, comment }).then(() => ({ booking: { ...b, reviewed: true } })), 'Could not submit')} />
            </View>
          ) : null}
          {isClient && b.reviewed ? <Text style={{ color: colors.success, marginTop: 10 }}>Thanks for your review!</Text> : null}
        </Card>
      ) : null}

      {b.status === 'cancelled' ? <Card><Text style={{ color: colors.muted }}>This booking was cancelled{b.cancelReason ? `: ${b.cancelReason}` : '.'} Any payment is refunded to the original method.</Text></Card> : null}

      {b.status === 'pending_payment' || b.status === 'confirmed' ? <Button title="Cancel booking" variant="outline" onPress={cancel} /> : null}
    </ScrollView>
  );
}
