import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, Pressable } from 'react-native';
import { useAuth } from '../auth';
import { useNav } from '../nav';
import { colors } from '../theme';
import { Button, Input, showAlert } from '../ui';
import { ApiError } from '../api';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, maxWidth: 460, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function LoginScreen() {
  const { login } = useAuth();
  const nav = useNav();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      showAlert('Login failed', (e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <View style={{ alignItems: 'center', marginTop: 70, marginBottom: 36 }}>
        <Text style={{ fontSize: 34, fontWeight: '900', color: colors.primary }}>SkillConnect</Text>
        <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'center' }}>Show your skills. Hire talent by the hour, day, month or year.</Text>
      </View>
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" onSubmitEditing={submit} />
      <Button title="Log in" onPress={submit} loading={busy} disabled={!email || !password} />
      <Pressable onPress={() => nav.navigate('Register')} style={{ marginTop: 18, alignItems: 'center' }}>
        <Text style={{ color: colors.muted }}>
          New here? <Text style={{ color: colors.primary, fontWeight: '700' }}>Create an account</Text>
        </Text>
      </Pressable>
    </Shell>
  );
}

export function RegisterScreen() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      await register({ ...form, email: form.email.trim() });
    } catch (e) {
      showAlert('Could not sign up', (e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Input label="Full name" value={form.name} onChangeText={set('name')} placeholder="Your name" />
      <Input label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
      <Input label="Phone (shared only with people you work with)" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="+91 98765 43210" />
      <Input label="City" value={form.city} onChangeText={set('city')} placeholder="e.g. Delhi" />
      <Input label="Password (min 8 characters)" value={form.password} onChangeText={set('password')} secureTextEntry />
      <Button title="Create account" onPress={submit} loading={busy} disabled={!form.name || !form.email || form.password.length < 8} />
    </Shell>
  );
}
