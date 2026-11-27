import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors } from '../theme';
import { Button, Card, Input, showAlert } from '../ui';
import { User } from '../types';

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={22} color={ok ? colors.success : '#f59e0b'} />
      <Text style={{ marginLeft: 8, fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </View>
  );
}

export default function VerifyScreen() {
  const { user, setUser, devEmailCode } = useAuth();
  const [emailCode, setEmailCode] = useState('');
  const [phone, setPhone] = useState(user!.phone ?? '');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [dev, setDev] = useState<{ email?: string; phone?: string }>({ email: devEmailCode ?? undefined });
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      showAlert('Verification', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sendEmail = () =>
    run('email-send', async () => {
      const r = await api.post<{ devCode?: string }>('/auth/email/send');
      setDev((d) => ({ ...d, email: r.devCode }));
      setEmailSent(true);
    });
  const verifyEmail = () =>
    run('email-verify', async () => {
      const r = await api.post<{ user: User }>('/auth/email/verify', { code: emailCode });
      setUser(r.user);
    });
  const sendPhone = () =>
    run('phone-send', async () => {
      const r = await api.post<{ devCode?: string }>('/auth/phone/send', { phone });
      setDev((d) => ({ ...d, phone: r.devCode }));
      setPhoneSent(true);
    });
  const verifyPhone = () =>
    run('phone-verify', async () => {
      const r = await api.post<{ user: User }>('/auth/phone/verify', { code: phoneCode });
      setUser(r.user);
    });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted, marginBottom: 12 }}>Verified accounts are trusted more and can hire people. Codes are valid for 15 minutes.</Text>

        <Card>
          <Row ok={user!.emailVerified} label={`Email: ${user!.email}`} />
          {!user!.emailVerified ? (
            <>
              {dev.email ? <Text style={{ color: colors.muted, marginBottom: 8 }}>Test mode (no email service configured) - code: {dev.email}</Text> : null}
              <Button title={emailSent ? 'Send code again' : 'Send code to my email'} variant="outline" onPress={sendEmail} loading={busy === 'email-send'} style={{ marginBottom: 10 }} />
              <Input label="6-digit email code" value={emailCode} onChangeText={(v) => setEmailCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} />
              <Button title="Verify email" onPress={verifyEmail} loading={busy === 'email-verify'} disabled={emailCode.length !== 6} />
            </>
          ) : null}
        </Card>

        <Card>
          <Row ok={user!.phoneVerified} label="Phone number" />
          {!user!.phoneVerified ? (
            <>
              <Input label="Phone with country code" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+919876543210" />
              {dev.phone ? <Text style={{ color: colors.muted, marginBottom: 8 }}>Test mode (no SMS service configured) - code: {dev.phone}</Text> : null}
              <Button title={phoneSent ? 'Send code again' : 'Send SMS code'} variant="outline" onPress={sendPhone} loading={busy === 'phone-send'} style={{ marginBottom: 10 }} />
              <Input label="6-digit SMS code" value={phoneCode} onChangeText={(v) => setPhoneCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} />
              <Button title="Verify phone" onPress={verifyPhone} loading={busy === 'phone-verify'} disabled={phoneCode.length !== 6} />
            </>
          ) : null}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
