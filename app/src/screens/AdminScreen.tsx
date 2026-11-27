import React, { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { colors } from '../theme';
import { Button, Card, Chip, confirmAction, Empty, Input, Loading, showAlert } from '../ui';
import { Complaint } from '../types';
import { categoryLabel, ACTION_TEXT } from './SupportScreens';
import { formatMoney, timeAgo } from '../utils';

type Section = 'dashboard' | 'complaints' | 'kyc' | 'payouts' | 'users';

const fail = (title: string) => (e: Error) => showAlert(title, e.message);

function Dashboard() {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    api.get('/admin/stats').then(setS).catch(fail('Could not load'));
  }, []);
  if (!s) return <Loading />;
  const stat = (label: string, value: string | number, warn = false) => (
    <View style={{ width: '50%', padding: 4 }}>
      <Card style={{ marginBottom: 0 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
        <Text style={{ fontSize: 24, fontWeight: '900', color: warn && Number(value) > 0 ? colors.danger : colors.text }}>{value}</Text>
      </Card>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
      {stat('Users', s.users)}
      {stat('People offering skills', s.providers)}
      {stat('Open complaints', s.openComplaints, true)}
      {stat('KYC to review', s.pendingKyc, true)}
      {stat('Payouts to send', s.pendingPayouts, true)}
      {stat('Completed bookings', s.bookings.completed ?? 0)}
      {stat('Bookings in progress', (s.bookings.in_progress ?? 0) + (s.bookings.confirmed ?? 0))}
      {stat('Cancelled', s.bookings.cancelled ?? 0)}
      {s.revenue.map((r: any) => (
        <View key={r.currency} style={{ width: '100%', padding: 4 }}>
          <Card style={{ marginBottom: 0 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Completed bookings value ({r.currency})</Text>
            <Text style={{ fontSize: 22, fontWeight: '900' }}>{formatMoney(r.gmvMinor, r.currency)}</Text>
            <Text style={{ color: colors.success, fontWeight: '700' }}>Platform fees: {formatMoney(r.feesMinor, r.currency)}</Text>
          </Card>
        </View>
      ))}
    </View>
  );
}

function ComplaintAdmin({ id, onDone }: { id: string; onDone: () => void }) {
  const [d, setD] = useState<{ complaint: Complaint; booking?: { status: string; skill: string; amountMinor: number; currency: string; providerEarningMinor: number; refundableMinor: number } } | null>(null);
  const [note, setNote] = useState('');
  const [partial, setPartial] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get<any>(`/admin/complaints/${id}`).then(setD).catch(fail('Could not load')), [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (!d) return <Loading />;
  const { complaint: c, booking: b } = d;

  const resolve = async (action: string) => {
    if (!(await confirmAction('Confirm decision', ACTION_TEXT[action], 'Confirm'))) return;
    setBusy(true);
    try {
      await api.post(`/admin/complaints/${id}/resolve`, { action, note, refundMinor: Math.round(Number(partial) * 100) });
      onDone();
    } catch (e) {
      showAlert('Could not resolve', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reply = async () => {
    await api.post(`/complaints/${id}/reply`, { text: msg }).catch(fail('Could not send'));
    setMsg('');
    load();
  };

  return (
    <View style={{ marginTop: 8 }}>
      <Text>{c.description}</Text>
      {b ? (
        <Text style={{ color: colors.muted, marginTop: 6 }}>
          Booking: {b.skill} · {b.status} · {formatMoney(b.amountMinor, b.currency)} (provider gets {formatMoney(b.providerEarningMinor, b.currency)}) · refundable now: {formatMoney(b.refundableMinor, b.currency)}
        </Text>
      ) : null}
      {c.messages.map((m) => (
        <Text key={m.id} style={{ marginTop: 4, fontSize: 12 }}>
          <Text style={{ fontWeight: '800' }}>{m.isAdmin ? 'Admin' : m.from === c.raisedBy.id ? c.raisedBy.name : c.against.name}: </Text>
          {m.text}
        </Text>
      ))}
      <Input value={msg} onChangeText={setMsg} placeholder="Message to the people involved" style={{ marginTop: 8 }} />
      <Button title="Send message" variant="outline" onPress={reply} disabled={!msg.trim()} />
      <Input label="Decision note (shown to both)" value={note} onChangeText={setNote} style={{ marginTop: 10 }} />
      {b ? <Input label="Partial refund amount" value={partial} onChangeText={(v) => setPartial(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" /> : null}
      {b && b.refundableMinor > 0 ? (
        <>
          <Button title="Refund in full" variant="danger" onPress={() => resolve('refund_full')} loading={busy} style={{ marginBottom: 8 }} />
          <Button title="Refund the amount above" variant="outline" onPress={() => resolve('refund_partial')} loading={busy} disabled={!(Number(partial) > 0)} style={{ marginBottom: 8 }} />
        </>
      ) : null}
      <Button title="No refund - release to provider" variant="success" onPress={() => resolve('release_provider')} loading={busy} style={{ marginBottom: 8 }} />
      <Button title="Dismiss complaint" variant="outline" onPress={() => resolve('dismiss')} loading={busy} />
    </View>
  );
}

function Complaints() {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => api.get<{ complaints: Complaint[] }>('/admin/complaints', { status: 'open' }).then((r) => setItems(r.complaints)).catch(fail('Could not load')), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!items) return <Loading />;
  if (!items.length) return <Empty icon="checkmark-done-outline" text="No open complaints." />;
  return (
    <>
      {items.map((c) => (
        <Card key={c.id}>
          <Text style={{ fontWeight: '800' }}>{categoryLabel(c.category)} · {c.type}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{c.raisedBy.name} vs {c.against.name} · {timeAgo(c.createdAt)}</Text>
          <Button title={open === c.id ? 'Hide' : 'Review'} variant="outline" onPress={() => setOpen(open === c.id ? null : c.id)} style={{ marginTop: 8 }} />
          {open === c.id ? <ComplaintAdmin id={c.id} onDone={() => { setOpen(null); load(); }} /> : null}
        </Card>
      ))}
    </>
  );
}

function Kyc() {
  const [items, setItems] = useState<any[] | null>(null);
  const [reason, setReason] = useState('');
  const load = useCallback(() => api.get<{ items: any[] }>('/admin/kyc').then((r) => setItems(r.items)).catch(fail('Could not load')), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!items) return <Loading />;
  if (!items.length) return <Empty icon="id-card-outline" text="No KYC waiting for review." />;
  const review = async (userId: string, approve: boolean) => {
    try {
      await api.post(`/admin/kyc/${userId}/review`, { approve, reason });
      setReason('');
      load();
    } catch (e) {
      showAlert('Could not save', (e as Error).message);
    }
  };
  return (
    <>
      {items.map((k) => (
        <Card key={k.userId}>
          <Text style={{ fontWeight: '800' }}>{k.legalName}</Text>
          <Text style={{ color: colors.muted }}>{k.name} · {k.email}</Text>
          <Text style={{ marginTop: 4 }}>{k.idType}: {k.idNumber}</Text>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {k.frontUrl ? <Image source={{ uri: k.frontUrl }} style={{ width: 150, height: 110, borderRadius: 8, marginRight: 8, backgroundColor: colors.border }} resizeMode="cover" /> : null}
            {k.selfieUrl ? <Image source={{ uri: k.selfieUrl }} style={{ width: 110, height: 110, borderRadius: 8, backgroundColor: colors.border }} resizeMode="cover" /> : null}
          </View>
          <Input label="Reason (needed to reject)" value={reason} onChangeText={setReason} style={{ marginTop: 8 }} />
          <View style={{ flexDirection: 'row' }}>
            <Button title="Approve" variant="success" onPress={() => review(k.userId, true)} style={{ flex: 1, marginRight: 8 }} />
            <Button title="Reject" variant="danger" onPress={() => review(k.userId, false)} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}
    </>
  );
}

function Payouts() {
  const [items, setItems] = useState<any[] | null>(null);
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const load = useCallback(() => api.get<{ payouts: any[] }>('/admin/payouts').then((r) => setItems(r.payouts)).catch(fail('Could not load')), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!items) return <Loading />;
  if (!items.length) return <Empty icon="cash-outline" text="No withdrawals waiting." />;
  const process = async (id: string, action: 'paid' | 'reject') => {
    try {
      await api.post(`/admin/payouts/${id}/process`, { action, txnRef: ref, note });
      setRef('');
      setNote('');
      load();
    } catch (e) {
      showAlert('Could not save', (e as Error).message);
    }
  };
  return (
    <>
      <Text style={{ color: colors.muted, marginBottom: 8 }}>Send the money from your bank/UPI to the account below, then enter the transaction reference and mark it paid.</Text>
      {items.map((p) => (
        <Card key={p.id}>
          <Text style={{ fontWeight: '900', fontSize: 18 }}>{formatMoney(p.amountMinor, p.currency)}</Text>
          <Text style={{ fontWeight: '700' }}>{p.user.name} (KYC: {p.user.legalName})</Text>
          <Text style={{ marginTop: 4 }}>
            {p.destination.kind === 'bank' ? `Bank a/c ${p.destination.accountNumber} · IFSC ${p.destination.ifsc}` : `UPI ${p.destination.upiId}`}
          </Text>
          <Input label="Transaction reference (UTR)" value={ref} onChangeText={setRef} style={{ marginTop: 8 }} />
          <Input label="Note / rejection reason" value={note} onChangeText={setNote} />
          <View style={{ flexDirection: 'row' }}>
            <Button title="Mark paid" variant="success" onPress={() => process(p.id, 'paid')} style={{ flex: 1, marginRight: 8 }} />
            <Button title="Reject" variant="danger" onPress={() => process(p.id, 'reject')} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}
    </>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<any[] | null>(null);
  const load = useCallback(() => api.get<{ users: any[] }>('/admin/users', { q }).then((r) => setItems(r.users)).catch(fail('Could not load')), [q]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);
  const toggle = async (u: any) => {
    if (!(await confirmAction(u.isActive ? 'Ban user' : 'Unban user', `${u.name} (${u.email})`, 'Confirm'))) return;
    await api.post(`/admin/users/${u.id}/ban`, { banned: u.isActive }).catch(fail('Could not update'));
    load();
  };
  return (
    <>
      <Input value={q} onChangeText={setQ} placeholder="Search name or email" autoCapitalize="none" />
      {!items ? <Loading /> : null}
      {items?.map((u) => (
        <Card key={u.id}>
          <Text style={{ fontWeight: '800' }}>{u.name}{u.role === 'admin' ? ' (admin)' : ''}{u.isActive ? '' : ' - BANNED'}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{u.email} · {u.city || 'no city'} · {u.completedJobs} jobs</Text>
          <Text style={{ fontSize: 12 }}>Email {u.emailVerified ? 'verified' : 'not verified'} · Phone {u.phoneVerified ? 'verified' : 'not verified'} · KYC {u.kycStatus}</Text>
          {u.role !== 'admin' ? <Button title={u.isActive ? 'Ban' : 'Unban'} variant={u.isActive ? 'danger' : 'success'} onPress={() => toggle(u)} style={{ marginTop: 8 }} /> : null}
        </Card>
      ))}
    </>
  );
}

export default function AdminScreen() {
  const [section, setSection] = useState<Section>('dashboard');
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const tabs: [Section, string][] = [['dashboard', 'Dashboard'], ['complaints', 'Complaints'], ['kyc', 'KYC'], ['payouts', 'Payouts'], ['users', 'Users']];
  return (
    <ScrollView
      contentContainerStyle={{ padding: 14, maxWidth: 700, width: '100%', alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setNonce((n) => n + 1); setTimeout(() => setRefreshing(false), 400); }} />}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {tabs.map(([k, l]) => (
          <Chip key={k} label={l} selected={section === k} onPress={() => setSection(k)} />
        ))}
      </View>
      <View key={`${section}-${nonce}`}>
        {section === 'dashboard' ? <Dashboard /> : null}
        {section === 'complaints' ? <Complaints /> : null}
        {section === 'kyc' ? <Kyc /> : null}
        {section === 'payouts' ? <Payouts /> : null}
        {section === 'users' ? <Users /> : null}
      </View>
    </ScrollView>
  );
}
