import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useNav, TabParamList } from '../nav';
import { colors, PLANS } from '../theme';
import { Avatar, Chip, Empty, Loading, StatusDot, StatusPill, Stars } from '../ui';
import { User } from '../types';
import { Coords, getCurrentCoords } from '../location';
import { formatRate, lowestRate } from '../utils';

const QUICK = ['Driver', 'Carpenter', 'Painter', 'Plumber', 'Electrician', 'Software Engineer', 'Doctor', 'Teacher', 'Photographer', 'Cook'];

export function UserRow({ u }: { u: User }) {
  const nav = useNav();
  const best = u.skills.map(lowestRate).find(Boolean);
  const cur = u.skills[0]?.currency ?? 'INR';
  const unit = best ? PLANS.find((p) => p.key === best.plan)?.unit : '';
  return (
    <Pressable
      onPress={() => nav.navigate('Profile', { userId: u.id })}
      style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', maxWidth: 680, width: '100%', alignSelf: 'center' }}
    >
      <View style={{ alignSelf: 'flex-start' }}>
        <Avatar uri={u.avatar} name={u.name} size={60} />
        <View style={{ position: 'absolute', right: -1, bottom: -1 }}>
          <StatusDot status={u.status} size={16} />
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>{u.name}</Text>
        <Text style={{ color: colors.primary, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
          {u.skills.map((s) => s.name).join(' · ')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Stars value={u.ratingAvg} />
          <Text style={{ marginLeft: 4, color: colors.muted, fontSize: 12 }}>
            {u.ratingCount ? `${u.ratingAvg.toFixed(1)} (${u.ratingCount})` : 'New'}
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
          {[u.city, u.distanceKm != null ? `${u.distanceKm} km away` : null, `${u.completedJobs} jobs`].filter(Boolean).join(' · ')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'space-between' }}>
          <StatusPill status={u.status} />
          {best ? (
            <Text style={{ fontWeight: '800', color: colors.text }}>
              {formatRate(best.amount, cur)}
              <Text style={{ fontWeight: '500', color: colors.muted }}>/{unit}</Text>
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<TabParamList, 'Explore'>>();
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState<'rating' | 'nearby'>('rating');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  useEffect(() => {
    if (route.params?.q) setQ(route.params.q);
  }, [route.params?.q]);

  const search = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const r = await api.get<{ users: User[] }>('/search', {
        q: q.trim(),
        city: city.trim(),
        sort: sort === 'nearby' && coords ? 'nearby' : 'rating',
        lat: coords?.lat,
        lng: coords?.lng,
        radiusKm: 50,
        availableOnly: availableOnly ? 1 : undefined,
      });
      if (mine === seq.current) setUsers(r.users);
    } catch {
      if (mine === seq.current) setUsers([]);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [q, city, sort, coords, availableOnly]);

  // Debounce typing.
  useEffect(() => {
    const t = setTimeout(search, 350);
    return () => clearTimeout(t);
  }, [search]);

  const toggleNearby = async () => {
    if (sort === 'nearby') {
      setSort('rating');
      setCoords(null);
      return;
    }
    const c = await getCurrentCoords();
    if (c) {
      setCoords(c);
      setSort('nearby');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search skill or name (driver, carpenter, Ramesh...)" placeholderTextColor="#9ca3af" style={{ flex: 1, paddingVertical: 11, paddingHorizontal: 8, fontSize: 15 }} autoCorrect={false} />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 12, marginTop: 8 }}>
          <Ionicons name="location-outline" size={18} color={colors.muted} />
          <TextInput value={city} onChangeText={setCity} placeholder="City (e.g. Delhi)" placeholderTextColor="#9ca3af" style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15 }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <Chip label={sort === 'nearby' ? 'Nearby: on' : 'Near me'} selected={sort === 'nearby'} onPress={toggleNearby} />
          <Chip label="Available now" selected={availableOnly} onPress={() => setAvailableOnly((v) => !v)} />
          {QUICK.map((s) => (
            <Chip key={s} label={s} selected={q.toLowerCase() === s.toLowerCase()} onPress={() => setQ(q.toLowerCase() === s.toLowerCase() ? '' : s)} />
          ))}
        </ScrollView>
      </View>
      {loading && !users.length ? (
        <Loading />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 14 }}
          renderItem={({ item }) => <UserRow u={item} />}
          ListHeaderComponent={users.length ? <Text style={{ color: colors.muted, marginBottom: 8, fontSize: 12 }}>{sort === 'nearby' ? 'Closest first' : 'Highest rated first'}</Text> : undefined}
          ListEmptyComponent={<Empty text="No one found. Try another skill, name or city." />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}
