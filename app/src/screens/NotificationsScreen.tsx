import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useNav } from '../nav';
import { colors } from '../theme';
import { Empty, Loading } from '../ui';
import { AppNotification } from '../types';
import { timeAgo } from '../utils';
import { useSocketEvent } from '../realtime';

export default function NotificationsScreen() {
  const nav = useNav();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ notifications: AppNotification[] }>('/notifications');
      setItems(r.notifications);
      api.post('/notifications/read').catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  useSocketEvent('notification', load);

  if (loading) return <Loading />;

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      ListEmptyComponent={<Empty icon="notifications-outline" text="Nothing yet. Booking updates will appear here." />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            if (item.data.bookingId) nav.navigate('BookingDetail', { bookingId: item.data.bookingId });
          }}
          style={{ padding: 14, backgroundColor: item.read ? '#fff' : colors.primary + '10', borderBottomWidth: 1, borderColor: colors.border }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '800', flex: 1 }}>{item.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{timeAgo(item.createdAt)}</Text>
          </View>
          {item.body ? <Text style={{ color: colors.muted, marginTop: 3 }}>{item.body}</Text> : null}
        </Pressable>
      )}
    />
  );
}
