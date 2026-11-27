import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, uploadImages } from '../api';
import { useAuth } from '../auth';
import { useNav } from '../nav';
import { colors } from '../theme';
import { Avatar, Button, Input, showAlert } from '../ui';
import { User } from '../types';
import { getCurrentCoords, reverseCity } from '../location';

export default function EditProfileScreen() {
  const { user, setUser } = useAuth();
  const nav = useNav();
  const [form, setForm] = useState({
    name: user!.name,
    bio: user!.bio,
    phone: user!.phone ?? '',
    city: user!.city,
    country: user!.country,
    avatar: user!.avatar,
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(user!.coords);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickAvatar = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (r.canceled) return;
    setBusy(true);
    try {
      const [url] = await uploadImages([r.assets[0].uri]);
      set('avatar')(url);
    } catch (e) {
      showAlert('Upload failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    const c = await getCurrentCoords();
    if (!c) {
      showAlert('Location unavailable', 'Allow location access to let people find you nearby.');
    } else {
      setCoords(c);
      const place = await reverseCity(c);
      if (place) setForm((f) => ({ ...f, city: place.city || f.city, country: place.country || f.country }));
    }
    setLocating(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.patch<{ user: User }>('/users/me', { ...form, lat: coords?.lat, lng: coords?.lng });
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
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={pickAvatar} style={{ alignItems: 'center', marginBottom: 16 }}>
          <Avatar uri={form.avatar} name={form.name} size={96} />
          <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 8 }}>Change photo</Text>
        </Pressable>
        <Input label="Name" value={form.name} onChangeText={set('name')} />
        <Input label="About you" value={form.bio} onChangeText={set('bio')} multiline maxLength={500} placeholder="Tell people about your work and experience" />
        <Input label="Phone (visible only to people in an active booking with you)" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Input label="City" value={form.city} onChangeText={set('city')} />
        <Input label="Country" value={form.country} onChangeText={set('country')} />
        <View style={{ marginBottom: 16 }}>
          <Button title={coords ? 'Update my location' : 'Use my current location'} variant="outline" icon="locate" onPress={useMyLocation} loading={locating} />
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{coords ? 'Location saved - you appear in "Near me" searches.' : 'Needed for "Near me" search results.'}</Text>
        </View>
        <Button title="Save changes" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
