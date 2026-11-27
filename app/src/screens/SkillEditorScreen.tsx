import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth';
import { useNav } from '../nav';
import { colors, CURRENCIES, PLANS } from '../theme';
import { Button, Card, Chip, Input, showAlert } from '../ui';
import { PlanKey, Skill, User } from '../types';

type Draft = Omit<Skill, 'rates'> & { rates: Record<PlanKey, string> };

const toDraft = (s?: Skill): Draft => ({
  _id: s?._id,
  name: s?.name ?? '',
  category: s?.category ?? 'Other',
  description: s?.description ?? '',
  experienceYears: s?.experienceYears ?? 0,
  currency: s?.currency ?? 'INR',
  rates: {
    hourly: s?.rates.hourly ? String(s.rates.hourly) : '',
    daily: s?.rates.daily ? String(s.rates.daily) : '',
    monthly: s?.rates.monthly ? String(s.rates.monthly) : '',
    yearly: s?.rates.yearly ? String(s.rates.yearly) : '',
  },
});

export default function SkillEditorScreen() {
  const { user, setUser } = useAuth();
  const nav = useNav();
  const [drafts, setDrafts] = useState<Draft[]>(() => (user!.skills.length ? user!.skills.map(toDraft) : [toDraft()]));
  const [categories, setCategories] = useState<{ name: string; skills: string[] }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ categories: { name: string; skills: string[] }[] }>('/search/categories').then((r) => setCategories(r.categories)).catch(() => {});
  }, []);

  const update = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const suggestions = categories.flatMap((c) => c.skills.map((name) => ({ name, category: c.name })));

  const save = async () => {
    setBusy(true);
    try {
      const skills = drafts.map((d) => ({
        ...d,
        experienceYears: Number(d.experienceYears) || 0,
        rates: Object.fromEntries(PLANS.map((p) => [p.key, Number(d.rates[p.key]) || undefined]).filter(([, v]) => v)),
      }));
      const r = await api.put<{ user: User }>('/users/me/skills', { skills });
      setUser(r.user);
      nav.goBack();
    } catch (e) {
      showAlert('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 600, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted, marginBottom: 12 }}>Add each skill with the prices you charge. People pick a price when they hire you. Leave a price empty if you don't offer it.</Text>
        {drafts.map((d, i) => {
          const q = d.name.trim().toLowerCase();
          const hints = q ? suggestions.filter((s) => s.name.toLowerCase().includes(q) && s.name.toLowerCase() !== q).slice(0, 5) : [];
          return (
            <Card key={d._id ?? i}>
              <Input label="Skill" value={d.name} onChangeText={(v) => update(i, { name: v })} placeholder="e.g. Driver, Carpenter, Doctor" />
              {hints.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -4, marginBottom: 6 }}>
                  {hints.map((h) => (
                    <Chip key={h.name} label={h.name} onPress={() => update(i, { name: h.name, category: h.category })} />
                  ))}
                </View>
              ) : null}
              <Input label="Category" value={d.category} onChangeText={(v) => update(i, { category: v })} />
              <Input label="Years of experience" value={String(d.experienceYears || '')} onChangeText={(v) => update(i, { experienceYears: Number(v.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" />
              <Input label="Describe your service" value={d.description} onChangeText={(v) => update(i, { description: v })} multiline maxLength={500} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>Currency</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                {CURRENCIES.map((c) => (
                  <Chip key={c} label={c} selected={d.currency === c} onPress={() => update(i, { currency: c })} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                {PLANS.map((p) => (
                  <View key={p.key} style={{ width: '50%', paddingHorizontal: 4 }}>
                    <Input label={`Price per ${p.unit}`} value={d.rates[p.key]} onChangeText={(v) => update(i, { rates: { ...d.rates, [p.key]: v.replace(/[^\d.]/g, '') } })} keyboardType="decimal-pad" placeholder="-" />
                  </View>
                ))}
              </View>
              {drafts.length > 1 ? <Button title="Remove skill" variant="outline" onPress={() => setDrafts((x) => x.filter((_, j) => j !== i))} /> : null}
            </Card>
          );
        })}
        <Button title="+ Add another skill" variant="outline" onPress={() => setDrafts((d) => [...d, toDraft()])} style={{ marginBottom: 12 }} />
        <Button title="Save skills" onPress={save} loading={busy} disabled={drafts.some((d) => !d.name.trim())} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
