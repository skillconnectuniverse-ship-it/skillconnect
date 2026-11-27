import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { postForm } from '../api';
import { useNav } from '../nav';
import { colors } from '../theme';
import { Button, Chip, Input, showAlert } from '../ui';

const ID_TYPES = [
  ['aadhaar', 'Aadhaar'],
  ['pan', 'PAN'],
  ['passport', 'Passport'],
  ['driving_license', 'Driving licence'],
  ['voter_id', 'Voter ID'],
  ['other', 'Other'],
] as const;

function PhotoPick({ label, uri, onPick }: { label: string; uri?: string; onPick: (u: string) => void }) {
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) onPick(r.assets[0].uri);
  };
  return (
    <Pressable onPress={pick} style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: 12, height: 150, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <>
          <Ionicons name="camera-outline" size={30} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function KycScreen() {
  const nav = useNav();
  const [legalName, setLegalName] = useState('');
  const [idType, setIdType] = useState<string>('aadhaar');
  const [idNumber, setIdNumber] = useState('');
  const [front, setFront] = useState<string>();
  const [selfie, setSelfie] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await postForm('/wallet/kyc', { legalName, idType, idNumber }, { front, selfie });
      showAlert('Submitted', 'Your documents are under review. You will be notified once verified.');
      nav.goBack();
    } catch (e) {
      showAlert('Could not submit', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted, marginBottom: 14 }}>KYC is required once, before your first withdrawal. Your documents are stored privately and seen only by our verification team.</Text>
        <Input label="Full legal name (as on ID and bank account)" value={legalName} onChangeText={setLegalName} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>ID type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
          {ID_TYPES.map(([k, l]) => (
            <Chip key={k} label={l} selected={idType === k} onPress={() => setIdType(k)} />
          ))}
        </View>
        <Input label="ID number" value={idNumber} onChangeText={setIdNumber} autoCapitalize="characters" />
        <PhotoPick label="Add photo of your ID" uri={front} onPick={setFront} />
        <PhotoPick label="Add a selfie holding the ID (optional)" uri={selfie} onPick={setSelfie} />
        <Button title="Submit for verification" onPress={submit} loading={busy} disabled={legalName.trim().length < 2 || idNumber.length < 4 || !front} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
