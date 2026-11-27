import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useNav } from '../nav';
import { BOOKING_BADGE, colors } from '../theme';
import { Avatar, Chip, Empty, Loading } from '../ui';
import { Booking } from '../types';
import { formatMoney, planLabel } from '../utils';
import { useSocketEvent } from '../realtime';

export default function BookingsScreen() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<'client' | 'provider'>('client');
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ bookings: Booking[] }>('/bookings', { role });
      setItems(r.bookings);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  useSocketEvent('booking:update', load);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontSize: 22, fontWeight: '900', marginBottom: 10 }}>Bookings</Text>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="I hired" selected={role === 'client'} onPress={() => { setLoading(true); setRole('client'); }} />
          <Chip label="My jobs" selected={role === 'provider'} onPress={() => { setLoading(true); setRole('provider'); }} />
        </View>
      </View>
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<Empty icon="briefcase-outline" text={role === 'client' ? 'You have not hired anyone yet. Use Explore to find skilled people.' : 'No jobs yet. Keep your profile and availability up to date to get hired.'} />}
          renderItem={({ item: b }) => {
            const other = b.role === 'client' ? b.provider : b.client;
            const badge = BOOKING_BADGE[b.status];
            return (
              <Pressable onPress={() => nav.navigate('BookingDetail', { bookingId: b.id })} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar uri={other.avatar} name={other.name} size={44} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontWeight: '800' }}>{other.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{b.skill.name} · {planLabel(b.plan, b.quantity)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '800' }}>{formatMoney(b.amountMinor, b.currency)}</Text>
                    <Text style={{ color: badge.color, fontWeight: '700', fontSize: 12 }}>{badge.label}</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
