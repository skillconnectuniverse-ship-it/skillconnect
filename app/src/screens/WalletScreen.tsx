import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useNav } from '../nav';
import { colors } from '../theme';
import { Button, Card, Chip, confirmAction, Input, Loading, SectionTitle, showAlert } from '../ui';
import { WalletData } from '../types';
import { formatMoney, timeAgo } from '../utils';

const KYC_TEXT = {
  none: { label: 'KYC not done', color: '#f59e0b', hint: 'Verify your identity once to withdraw money.' },
  pending: { label: 'KYC under review', color: '#3b82f6', hint: 'We are checking your documents.' },
  verified: { label: 'KYC verified', color: colors.success, hint: 'You can withdraw your earnings.' },
  rejected: { label: 'KYC rejected', color: colors.danger, hint: 'Please submit again with clear documents.' },
} as const;

const KIND_LABEL: Record<string, string> = { earning: 'Earning', payout: 'Withdrawal', payout_refund: 'Withdrawal returned', reversal: 'Refund adjustment' };

export default function WalletScreen() {
  const nav = useNav();
  const [w, setW] = useState<WalletData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState('INR');
  const [amount, setAmount] = useState('');
  const [editMethod, setEditMethod] = useState(false);
  const [kind, setKind] = useState<'bank' | 'upi'>('bank');
  const [holder, setHolder] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upi, setUpi] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<WalletData>('/wallet');
      setW(r);
      setCurrency((c) => (r.balances.some((b) => b.currency === c) ? c : r.balances[0]?.currency ?? c));
    } catch (e) {
      showAlert('Could not load wallet', (e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!w) return <Loading />;

  const bal = w.balances.find((b) => b.currency === currency);
  const kyc = KYC_TEXT[w.kyc.status];

  const saveMethod = async () => {
    setBusy('method');
    try {
      await api.put('/wallet/payout-method', { kind, holderName: holder, accountNumber: account, ifsc, upiId: upi });
      setEditMethod(false);
      await load();
    } catch (e) {
      showAlert('Could not save', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async () => {
    const minor = Math.round(Number(amount) * 100);
    if (!(await confirmAction('Withdraw', `Request ${formatMoney(minor, currency)} to ${w.payoutMethod?.label}?`, 'Withdraw'))) return;
    setBusy('withdraw');
    try {
      await api.post('/wallet/payouts', { currency, amountMinor: minor });
      setAmount('');
      showAlert('Request sent', 'Our team will send the money to your account and notify you.');
      await load();
    } catch (e) {
      showAlert('Could not withdraw', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 600, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {w.balances.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {w.balances.map((b) => (
            <Chip key={b.currency} label={b.currency} selected={b.currency === currency} onPress={() => setCurrency(b.currency)} />
          ))}
        </View>
      ) : null}
      <Card style={{ backgroundColor: colors.primary + '10' }}>
        <Text style={{ color: colors.muted }}>Available to withdraw</Text>
        <Text style={{ fontSize: 32, fontWeight: '900' }}>{formatMoney(bal?.availableMinor ?? 0, currency)}</Text>
        <Text style={{ color: colors.muted, marginTop: 6 }}>
          Pending: {formatMoney(bal?.pendingMinor ?? 0, currency)} (earnings become available {w.holdHours} hours after a job ends, or after a complaint is settled)
        </Text>
      </Card>

      <Card>
        <Text style={{ fontWeight: '800', color: kyc.color }}>{kyc.label}</Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>{w.kyc.status === 'rejected' && w.kyc.rejectReason ? w.kyc.rejectReason : kyc.hint}</Text>
        {w.kyc.status === 'none' || w.kyc.status === 'rejected' ? <Button title="Verify identity (KYC)" onPress={() => nav.navigate('Kyc')} style={{ marginTop: 10 }} /> : null}
      </Card>

      <Card>
        <Text style={{ fontWeight: '800', marginBottom: 6 }}>Where to receive money</Text>
        {w.payoutMethod && !editMethod ? (
          <>
            <Text>{w.payoutMethod.holderName}</Text>
            <Text style={{ color: colors.muted }}>{w.payoutMethod.label}</Text>
            <Button title="Change" variant="outline" onPress={() => setEditMethod(true)} style={{ marginTop: 10 }} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row' }}>
              <Chip label="Bank account" selected={kind === 'bank'} onPress={() => setKind('bank')} />
              <Chip label="UPI" selected={kind === 'upi'} onPress={() => setKind('upi')} />
            </View>
            <Input label="Account holder name (must match KYC name)" value={holder} onChangeText={setHolder} />
            {kind === 'bank' ? (
              <>
                <Input label="Account number" value={account} onChangeText={setAccount} keyboardType="number-pad" />
                <Input label="IFSC code" value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase())} autoCapitalize="characters" maxLength={11} />
              </>
            ) : (
              <Input label="UPI ID" value={upi} onChangeText={setUpi} autoCapitalize="none" placeholder="name@bank" />
            )}
            <Button title="Save" onPress={saveMethod} loading={busy === 'method'} />
          </>
        )}
      </Card>

      <Card>
        <Text style={{ fontWeight: '800', marginBottom: 6 }}>Withdraw</Text>
        <Input label={`Amount (${currency}, minimum ${w.minPayoutMinor / 100})`} value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
        <Button
          title="Request withdrawal"
          onPress={withdraw}
          loading={busy === 'withdraw'}
          disabled={!w.payoutMethod || w.kyc.status !== 'verified' || !(Number(amount) * 100 >= w.minPayoutMinor)}
        />
        {w.kyc.status !== 'verified' ? <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>Complete KYC to enable withdrawals.</Text> : null}
      </Card>

      {w.payouts.length ? (
        <>
          <SectionTitle>Withdrawals</SectionTitle>
          {w.payouts.map((p) => (
            <Card key={p.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '800' }}>{formatMoney(p.amountMinor, p.currency)}</Text>
                <Text style={{ fontWeight: '700', color: p.status === 'paid' ? colors.success : p.status === 'rejected' ? colors.danger : '#f59e0b' }}>{p.status === 'requested' ? 'Processing' : p.status === 'paid' ? 'Sent' : 'Rejected'}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{p.destinationLabel} · {timeAgo(p.createdAt)}</Text>
              {p.txnRef ? <Text style={{ fontSize: 12 }}>Reference: {p.txnRef}</Text> : null}
              {p.status === 'rejected' && p.adminNote ? <Text style={{ fontSize: 12, color: colors.danger }}>{p.adminNote}</Text> : null}
            </Card>
          ))}
        </>
      ) : null}

      <SectionTitle>History</SectionTitle>
      {w.entries.length ? (
        w.entries.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontWeight: '600' }}>{KIND_LABEL[e.kind] ?? e.kind}{e.held ? ' (on hold)' : ''}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{[e.note, timeAgo(e.createdAt)].filter(Boolean).join(' · ')}</Text>
            </View>
            <Text style={{ fontWeight: '800', color: e.amountMinor < 0 ? colors.danger : colors.success }}>{e.amountMinor < 0 ? '-' : '+'}{formatMoney(Math.abs(e.amountMinor), e.currency)}</Text>
          </View>
        ))
      ) : (
        <Text style={{ color: colors.muted }}>No transactions yet. Earnings from completed jobs will show here.</Text>
      )}
    </ScrollView>
  );
}
