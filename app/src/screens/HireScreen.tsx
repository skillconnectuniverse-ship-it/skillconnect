import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { api } from '../api';
import { RootStackParamList, useNav } from '../nav';
import { colors, HIREABLE, PLANS } from '../theme';
import { Avatar, Button, Card, Chip, Input, Loading, showAlert, StatusPill, Stars } from '../ui';
import { Booking, PlanKey, User } from '../types';
import { Coords, geocodeAddress, getCurrentCoords, reverseCity } from '../location';
import { formatRate, formatMoney, planLabel } from '../utils';

export default function HireScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'Hire'>>();
  const nav = useNav();
  const [provider, setProvider] = useState<User | null>(null);
  const [skillId, setSkillId] = useState<string | undefined>(params.skillId);
  const [plan, setPlan] = useState<PlanKey | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ user: User }>(`/users/${params.providerId}`)
      .then((r) => {
        setProvider(r.user);
        setSkillId((id) => id ?? r.user.skills[0]?._id);
      })
      .catch((e) => showAlert('Could not load', e.message));
  }, [params.providerId]);

  const locate = async () => {
    setLocating(true);
    const c = await getCurrentCoords();
    if (c) {
      setCoords(c);
      const place = await reverseCity(c);
      if (place?.address) setAddress((a) => a || place.address);
    } else {
      showAlert('Location unavailable', 'Allow location access, or type the work address below.');
    }
    setLocating(false);
  };

  useEffect(() => {
    locate();
  }, []);

  const skill = useMemo(() => provider?.skills.find((s) => s._id === skillId), [provider, skillId]);

  // Keep the chosen plan valid when switching skills.
  useEffect(() => {
    if (!skill) return;
    if (!plan || !skill.rates[plan]) setPlan((PLANS.find((p) => skill.rates[p.key]) ?? PLANS[0]).key);
  }, [skill, plan]);

  if (!provider) return <Loading />;

  if (!HIREABLE.includes(provider.status)) {
    return (
      <View style={{ padding: 24 }}>
        <Text style={{ fontSize: 16, textAlign: 'center' }}>{provider.name} is not accepting work right now.</Text>
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <StatusPill status={provider.status} note={provider.statusNote} />
        </View>
      </View>
    );
  }

  const unitMinor = skill && plan && skill.rates[plan] ? Math.round(skill.rates[plan]! * 100) : 0;
  const total = unitMinor * quantity;

  const proceed = async () => {
    if (!skill || !plan || (!coords && !address.trim())) return;
    setBusy(true);
    try {
      const where = coords ?? (await geocodeAddress(address.trim()));
      if (!where) {
        showAlert('Address not found', 'Try a more detailed address or allow location access.');
        return;
      }
      const r = await api.post<{ booking: Booking }>('/bookings', {
        providerId: provider.id,
        skillId: skill._id,
        plan,
        quantity,
        lat: where.lat,
        lng: where.lng,
        address,
        notes,
      });
      nav.replace('Payment', { bookingId: r.booking.id });
    } catch (e) {
      showAlert('Could not create booking', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 600, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar uri={provider.avatar} name={provider.name} size={56} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 17 }}>{provider.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Stars value={provider.ratingAvg} />
              <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>{provider.ratingCount} reviews</Text>
            </View>
            <View style={{ marginTop: 6 }}>
              <StatusPill status={provider.status} note={provider.statusNote} />
            </View>
          </View>
        </Card>

        <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Skill</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {provider.skills.map((s) => (
            <Chip key={s._id} label={s.name} selected={s._id === skillId} onPress={() => setSkillId(s._id)} />
          ))}
        </View>

        {skill ? (
          <>
            <Text style={{ fontWeight: '800', fontSize: 16, marginVertical: 8 }}>Choose a price</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
              {PLANS.map((p) => {
                const rate = skill.rates[p.key];
                const selected = plan === p.key;
                return (
                  <View key={p.key} style={{ width: '50%', padding: 4 }}>
                    <Pressable
                      disabled={!rate}
                      onPress={() => setPlan(p.key)}
                      style={{ borderWidth: 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '12' : '#fff', borderRadius: 14, padding: 14, opacity: rate ? 1 : 0.4 }}
                    >
                      <Text style={{ color: colors.muted, fontWeight: '600' }}>{p.label}</Text>
                      <Text style={{ fontSize: 19, fontWeight: '800', marginTop: 4 }}>{rate ? formatRate(rate, skill.currency) : 'Not offered'}</Text>
                      {rate ? <Text style={{ color: colors.muted, fontSize: 12 }}>per {p.unit}</Text> : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 }}>
              <Text style={{ fontWeight: '700' }}>How many {plan ? PLANS.find((p) => p.key === plan)!.unit : ''}s?</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Button title="-" variant="outline" onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={{ paddingVertical: 6, paddingHorizontal: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: '800', marginHorizontal: 16 }}>{quantity}</Text>
                <Button title="+" variant="outline" onPress={() => setQuantity((q) => Math.min(1000, q + 1))} style={{ paddingVertical: 6, paddingHorizontal: 16 }} />
              </View>
            </View>
          </>
        ) : null}

        <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Where is the work?</Text>
        <Button title={coords ? 'Location captured - tap to refresh' : 'Use my current location'} variant="outline" icon="locate" onPress={locate} loading={locating} style={{ marginBottom: 10 }} />
        <Input label="Address / landmark" value={address} onChangeText={setAddress} placeholder="House no, street, landmark" />
        <Input label="Notes for the worker (optional)" value={notes} onChangeText={setNotes} multiline maxLength={500} />

        <Card style={{ backgroundColor: colors.primary + '10' }}>
          <Text style={{ color: colors.muted }}>{plan && skill ? `${skill.name} · ${planLabel(plan, quantity)}` : ''}</Text>
          <Text style={{ fontSize: 26, fontWeight: '900', marginTop: 2 }}>{skill ? formatMoney(total, skill.currency) : '-'}</Text>
        </Card>
        <Button title="Continue to payment" onPress={proceed} loading={busy} disabled={!skill || !plan || (!coords && !address.trim())} />
        {!coords ? <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>Allow location access or type the full address so the hired person can navigate to you.</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
