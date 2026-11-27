import React, { useCallback, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../auth';
import { useNav } from '../nav';
import { colors, HIREABLE, PLANS, STATUS, STATUS_ORDER } from '../theme';
import { Avatar, Button, Card, Chip, confirmAction, Empty, Input, Loading, showAlert, StatusPill, Stars } from '../ui';
import { Post, Review, StatusKey, User } from '../types';
import { formatRate, memberSince, timeAgo } from '../utils';

type Tab = 'posts' | 'skills' | 'reviews';

function StatusModal({ visible, current, note, onClose, onSaved }: { visible: boolean; current: StatusKey; note: string; onClose: () => void; onSaved: (u: User) => void }) {
  const [status, setStatus] = useState<StatusKey>(current);
  const [text, setText] = useState(note);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.patch<{ user: User }>('/users/me', { status, statusNote: text });
      onSaved(r.user);
      onClose();
    } catch (e) {
      showAlert('Could not update', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 12 }}>Set your availability</Text>
          {STATUS_ORDER.map((k) => (
            <Pressable key={k} onPress={() => setStatus(k)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: STATUS[k].color, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{STATUS[k].label}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{STATUS[k].hint}</Text>
              </View>
              {status === k ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            </Pressable>
          ))}
          <Input label="When are you available? (optional)" value={text} onChangeText={setText} placeholder="e.g. Today 5 PM - 9 PM" maxLength={120} />
          <Button title="Save" onPress={save} loading={busy} />
          <Button title="Cancel" variant="outline" onPress={onClose} style={{ marginTop: 8 }} />
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen({ userIdOverride }: { userIdOverride?: string }) {
  const route = useRoute();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user: me, logout, setUser: setMe } = useAuth();
  const userId = userIdOverride ?? (route.params as { userId: string }).userId;
  const isSelf = userId === me?.id;

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tab, setTab] = useState<Tab>('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, p, r] = await Promise.all([
        api.get<{ user: User }>(`/users/${userId}`),
        api.get<{ posts: Post[] }>('/posts', { author: userId, limit: 30 }),
        api.get<{ reviews: Review[] }>(`/users/${userId}/reviews`),
      ]);
      setProfile(u.user);
      setPosts(p.posts);
      setReviews(r.reviews);
    } catch (e) {
      showAlert('Could not load profile', (e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const deletePost = async (p: Post) => {
    if (!isSelf || !(await confirmAction('Delete post', 'Remove this photo from your profile?', 'Delete'))) return;
    await api.del(`/posts/${p.id}`);
    setPosts((prev) => prev.filter((x) => x.id !== p.id));
  };

  if (loading || !profile) return <Loading />;

  const hireable = HIREABLE.includes(profile.status);
  const cell = Math.min(width, 680) / 3;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: userIdOverride ? insets.top : 0, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center' }}>
        <View style={{ backgroundColor: '#fff', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar uri={profile.avatar} name={profile.name} size={88} />
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
              {[
                [String(posts.length), 'Posts'],
                [String(profile.completedJobs), 'Jobs done'],
                [profile.ratingCount ? profile.ratingAvg.toFixed(1) : '-', `${profile.ratingCount} reviews`],
              ].map(([v, l]) => (
                <View key={l} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800' }}>{v}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{l}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 12 }}>{profile.name}</Text>
          {profile.skills.length ? <Text style={{ color: colors.primary, fontWeight: '600', marginTop: 2 }}>{profile.skills.map((s) => s.name).join(' · ')}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Stars value={profile.ratingAvg} size={16} />
            <Text style={{ color: colors.muted, marginLeft: 6, fontSize: 12 }}>{profile.ratingCount ? `${profile.ratingAvg.toFixed(1)} from ${profile.ratingCount} reviews` : 'No reviews yet'}</Text>
          </View>
          {profile.bio ? <Text style={{ marginTop: 8, color: colors.text }}>{profile.bio}</Text> : null}
          <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>
            {[profile.city, profile.country].filter(Boolean).join(', ')}
            {profile.city || profile.country ? '  ·  ' : ''}On SkillConnect since {memberSince(profile.createdAt)}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            {([[profile.emailVerified, 'Email verified'], [profile.phoneVerified, 'Phone verified'], [profile.kycVerified, 'ID verified']] as const)
              .filter(([ok]) => ok)
              .map(([, label]) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="shield-checkmark" size={15} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700', marginLeft: 3 }}>{label}</Text>
                </View>
              ))}
            {profile.clientRatingCount ? <Text style={{ color: colors.muted, fontSize: 12 }}>As a client: {profile.clientRatingAvg.toFixed(1)} stars ({profile.clientRatingCount})</Text> : null}
          </View>

          <Pressable disabled={!isSelf} onPress={() => setStatusOpen(true)} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
            <StatusPill status={profile.status} note={profile.statusNote} />
            {isSelf ? <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ marginLeft: 6 }} /> : null}
          </Pressable>

          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            {isSelf ? (
              <>
                <Button title="Edit profile" variant="outline" onPress={() => nav.navigate('EditProfile')} style={{ flex: 1, marginRight: 8 }} />
                <Button title="Skills & prices" onPress={() => nav.navigate('SkillEditor')} style={{ flex: 1 }} />
              </>
            ) : (
              <>
                <Button
                  title={hireable ? 'Hire' : 'Not available'}
                  icon="briefcase"
                  disabled={!hireable || !profile.skills.length}
                  onPress={() => nav.navigate('Hire', { providerId: profile.id })}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button title="Message" variant="outline" icon="chatbubble-outline" onPress={() => nav.navigate('Chat', { userId: profile.id, name: profile.name })} style={{ flex: 1 }} />
              </>
            )}
          </View>
          {isSelf ? (
            <>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button title="Add post" variant="outline" icon="add" onPress={() => nav.navigate('CreatePost')} style={{ flex: 1, marginRight: 8 }} />
                <Button title="Wallet" variant="outline" icon="wallet-outline" onPress={() => nav.navigate('Wallet')} style={{ flex: 1 }} />
              </View>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button title="Support" variant="outline" icon="help-buoy-outline" onPress={() => nav.navigate('Support')} style={{ flex: 1, marginRight: 8 }} />
                <Button title="Log out" variant="outline" icon="log-out-outline" onPress={() => logout()} style={{ flex: 1 }} />
              </View>
              {!profile.emailVerified || !profile.phoneVerified ? <Button title="Verify email / phone" icon="shield-checkmark-outline" onPress={() => nav.navigate('Verify')} style={{ marginTop: 8 }} /> : null}
              {me?.role === 'admin' ? <Button title="Admin panel" variant="danger" icon="construct-outline" onPress={() => nav.navigate('Admin')} style={{ marginTop: 8 }} /> : null}
            </>
          ) : (
            <Pressable onPress={() => nav.navigate('Report', { userId: profile.id, name: profile.name })} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Report this user</Text>
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          {([['posts', 'grid-outline', 'Posts'], ['skills', 'pricetags-outline', 'Skills & prices'], ['reviews', 'star-outline', 'Reviews']] as const).map(([k, icon, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2, borderColor: tab === k ? colors.primary : 'transparent' }}>
              <Ionicons name={icon} size={20} color={tab === k ? colors.primary : colors.muted} />
              <Text style={{ fontSize: 11, color: tab === k ? colors.primary : colors.muted, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'posts' ? (
          posts.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {posts.map((p) => (
                <Pressable key={p.id} onLongPress={() => deletePost(p)} style={{ width: cell, height: cell, padding: 1 }}>
                  <Image source={{ uri: p.images[0] }} style={{ flex: 1, backgroundColor: colors.border }} />
                  {p.images.length > 1 ? <Ionicons name="copy" size={16} color="#fff" style={{ position: 'absolute', right: 8, top: 8 }} /> : null}
                </Pressable>
              ))}
            </View>
          ) : (
            <Empty icon="images-outline" text={isSelf ? 'Share photos of your work so people can trust you.' : 'No work photos yet.'} />
          )
        ) : null}

        {tab === 'skills' ? (
          <View style={{ padding: 14 }}>
            {profile.skills.length ? (
              profile.skills.map((s) => (
                <Card key={s._id ?? s.name}>
                  <Text style={{ fontSize: 17, fontWeight: '800' }}>{s.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>
                    {s.category}
                    {s.experienceYears ? ` · ${s.experienceYears} yrs experience` : ''}
                  </Text>
                  {s.description ? <Text style={{ marginBottom: 8 }}>{s.description}</Text> : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {PLANS.filter((p) => s.rates[p.key]).map((p) => (
                      <Chip key={p.key} label={`${formatRate(s.rates[p.key]!, s.currency)} / ${p.unit}`} />
                    ))}
                  </View>
                  {!isSelf && hireable ? <Button title={`Hire as ${s.name}`} onPress={() => nav.navigate('Hire', { providerId: profile.id, skillId: s._id })} style={{ marginTop: 6 }} /> : null}
                </Card>
              ))
            ) : (
              <Empty icon="pricetags-outline" text={isSelf ? 'Add your skills and prices so people can hire you.' : 'No skills listed.'} />
            )}
          </View>
        ) : null}

        {tab === 'reviews' ? (
          <View style={{ padding: 14 }}>
            {reviews.length ? (
              reviews.map((r) => (
                <Card key={r.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Avatar uri={r.client?.avatar} name={r.client?.name ?? '?'} size={34} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={{ fontWeight: '700' }}>{r.client?.name ?? 'User'}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{[r.skillName, timeAgo(r.createdAt)].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <Stars value={r.rating} />
                  </View>
                  {r.comment ? <Text style={{ marginTop: 8 }}>{r.comment}</Text> : null}
                </Card>
              ))
            ) : (
              <Empty icon="star-outline" text="No reviews yet." />
            )}
          </View>
        ) : null}
      </View>

      {isSelf ? (
        <StatusModal
          key={`${profile.status}|${profile.statusNote}|${statusOpen}`}
          visible={statusOpen}
          current={profile.status}
          note={profile.statusNote}
          onClose={() => setStatusOpen(false)}
          onSaved={(u) => {
            setProfile((p) => (p ? { ...p, status: u.status, statusNote: u.statusNote } : p));
            setMe(u);
          }}
        />
      ) : null}
    </ScrollView>
  );
}
