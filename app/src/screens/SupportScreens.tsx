import React, { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../auth';
import { RootStackParamList, useNav } from '../nav';
import { colors } from '../theme';
import { Button, Card, Chip, Empty, Input, Loading, showAlert } from '../ui';
import { Complaint } from '../types';
import { timeAgo } from '../utils';

export const CATEGORIES: [string, string][] = [
  ['no_show', 'Did not show up'],
  ['poor_quality', 'Poor quality work'],
  ['overcharge', 'Asked for extra money'],
  ['safety', 'Safety concern'],
  ['fraud', 'Fraud / fake profile'],
  ['abusive', 'Abusive behaviour'],
  ['payment_issue', 'Payment problem'],
  ['other', 'Other'],
];

export const categoryLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c;

export const STATUS_COLOR = { open: '#f59e0b', resolved: colors.success, dismissed: colors.muted } as const;

export const ACTION_TEXT: Record<string, string> = {
  refund_full: 'Full refund to the client',
  refund_partial: 'Partial refund to the client',
  release_provider: 'No refund - provider keeps the payment',
  dismiss: 'Complaint dismissed',
};

export function ReportScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'Report'>>();
  const nav = useNav();
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ complaint: Complaint }>('/complaints', { bookingId: params.bookingId, againstId: params.userId, category, description });
      showAlert('Complaint sent', params.bookingId ? 'The provider payment is on hold until our team decides. You can follow it in Support.' : 'Our team will review it.');
      nav.replace('Complaint', { complaintId: r.complaint.id });
    } catch (e) {
      showAlert('Could not send', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>{params.bookingId ? 'What went wrong with this booking?' : `Report ${params.name ?? 'this user'}`}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
          {CATEGORIES.map(([k, l]) => (
            <Chip key={k} label={l} selected={category === k} onPress={() => setCategory(k)} />
          ))}
        </View>
        <Input label="Describe the problem" value={description} onChangeText={setDescription} multiline maxLength={2000} placeholder="What happened? When? Any details help us decide faster." />
        <Button title="Submit complaint" onPress={submit} loading={busy} disabled={!category || description.trim().length < 10} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function SupportScreen() {
  const nav = useNav();
  const [items, setItems] = useState<Complaint[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.get<{ complaints: Complaint[] }>('/complaints/mine').then((r) => setItems(r.complaints)).catch(() => setItems([]));
    }, [])
  );

  if (!items) return <Loading />;
  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 14, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      ListEmptyComponent={<Empty icon="help-buoy-outline" text="No complaints. If a booking goes wrong, open it and tap 'Report a problem'." />}
      renderItem={({ item: c }) => (
        <Pressable onPress={() => nav.navigate('Complaint', { complaintId: c.id })}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '800' }}>{categoryLabel(c.category)}</Text>
              <Text style={{ fontWeight: '700', color: STATUS_COLOR[c.status] }}>{c.status}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{c.type === 'dispute' ? 'Booking dispute' : 'User report'} · {timeAgo(c.createdAt)}</Text>
            <Text numberOfLines={2} style={{ marginTop: 4 }}>{c.description}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

export function ComplaintScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'Complaint'>>();
  const { user } = useAuth();
  const nav = useNav();
  const [c, setC] = useState<Complaint | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get<{ complaint: Complaint }>(`/complaints/${params.complaintId}`);
    setC(r.complaint);
  }, [params.complaintId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => showAlert('Could not load', e.message));
    }, [load])
  );

  if (!c) return <Loading />;

  const reply = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ complaint: Complaint }>(`/complaints/${c.id}/reply`, { text });
      setC(r.complaint);
      setText('');
    } catch (e) {
      showAlert('Could not send', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 600, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '800', fontSize: 16 }}>{categoryLabel(c.category)}</Text>
            <Text style={{ fontWeight: '700', color: STATUS_COLOR[c.status] }}>{c.status}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, marginVertical: 4 }}>
            {c.raisedBy.id === user!.id ? 'You reported' : `${c.raisedBy.name ?? 'User'} reported you`} · {timeAgo(c.createdAt)}
          </Text>
          <Text>{c.description}</Text>
          {c.bookingId ? <Button title="Open booking" variant="outline" onPress={() => nav.navigate('BookingDetail', { bookingId: c.bookingId! })} style={{ marginTop: 10 }} /> : null}
        </Card>

        {c.resolution ? (
          <Card style={{ backgroundColor: colors.primary + '10' }}>
            <Text style={{ fontWeight: '800' }}>Decision: {ACTION_TEXT[c.resolution.action] ?? c.resolution.action}</Text>
            {c.resolution.note ? <Text style={{ marginTop: 4 }}>{c.resolution.note}</Text> : null}
          </Card>
        ) : null}

        {c.messages.map((m) => (
          <View key={m.id} style={{ alignSelf: m.from === user!.id ? 'flex-end' : 'flex-start', maxWidth: '85%', marginBottom: 8, backgroundColor: m.isAdmin ? '#fef3c7' : m.from === user!.id ? colors.primary : '#fff', borderRadius: 14, padding: 10, borderWidth: m.from === user!.id ? 0 : 1, borderColor: colors.border }}>
            {m.isAdmin ? <Text style={{ fontSize: 11, fontWeight: '800', color: '#b45309' }}>SkillConnect support</Text> : null}
            <Text style={{ color: m.from === user!.id && !m.isAdmin ? '#fff' : colors.text }}>{m.text}</Text>
          </View>
        ))}

        {c.status === 'open' ? (
          <View style={{ marginTop: 8 }}>
            <Input value={text} onChangeText={setText} placeholder="Add a message" multiline maxLength={1000} />
            <Button title="Send" onPress={reply} loading={busy} disabled={!text.trim()} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
