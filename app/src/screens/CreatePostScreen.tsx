import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api, uploadImages } from '../api';
import { useAuth } from '../auth';
import { useNav } from '../nav';
import { colors } from '../theme';
import { Button, Chip, Input, showAlert } from '../ui';

export default function CreatePostScreen() {
  const { user } = useAuth();
  const nav = useNav();
  const [uris, setUris] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [skillTag, setSkillTag] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 6 - uris.length, quality: 0.8 });
    if (!r.canceled) setUris((u) => [...u, ...r.assets.map((a) => a.uri)].slice(0, 6));
  };

  const publish = async () => {
    setBusy(true);
    try {
      const images = await uploadImages(uris);
      await api.post('/posts', { images, caption, skillTag });
      nav.goBack();
    } catch (e) {
      showAlert('Could not post', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
          {uris.map((u) => (
            <View key={u} style={{ marginRight: 8, marginBottom: 8 }}>
              <Image source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 10 }} />
              <Pressable onPress={() => setUris((x) => x.filter((y) => y !== u))} style={{ position: 'absolute', right: -6, top: -6 }}>
                <Ionicons name="close-circle" size={22} color={colors.danger} />
              </Pressable>
            </View>
          ))}
          {uris.length < 6 ? (
            <Pressable onPress={pick} style={{ width: 96, height: 96, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="camera-outline" size={28} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Add photo</Text>
            </Pressable>
          ) : null}
        </View>
        <Input label="Caption" value={caption} onChangeText={setCaption} multiline maxLength={1000} placeholder="Describe the work you did" />
        {user!.skills.length ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>Skill shown in this post</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {user!.skills.map((s) => (
                <Chip key={s.name} label={s.name} selected={skillTag === s.name} onPress={() => setSkillTag(skillTag === s.name ? '' : s.name)} />
              ))}
            </View>
          </View>
        ) : null}
        <Button title="Share" onPress={publish} loading={busy} disabled={!uris.length} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
