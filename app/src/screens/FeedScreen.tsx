import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useNav } from '../nav';
import { colors } from '../theme';
import { Avatar, Button, Empty, Loading, StatusDot } from '../ui';
import { Post } from '../types';
import { timeAgo } from '../utils';
import { useSocketEvent } from '../realtime';

export function PostCard({ post, onLike }: { post: Post; onLike: (p: Post) => void }) {
  const nav = useNav();
  const { width } = useWindowDimensions();
  const size = Math.min(width, 560);
  return (
    <View style={{ backgroundColor: '#fff', marginBottom: 14, alignSelf: 'center', width: size, borderRadius: 4 }}>
      <Pressable onPress={() => nav.navigate('Profile', { userId: post.author.id })} style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <View>
          <Avatar uri={post.author.avatar} name={post.author.name} size={40} />
          <View style={{ position: 'absolute', right: -2, bottom: -2 }}>
            <StatusDot status={post.author.status} size={14} />
          </View>
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{post.author.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {[post.author.city, post.skillTag].filter(Boolean).join(' · ') || timeAgo(post.createdAt)}
          </Text>
        </View>
        <Button title="Hire" onPress={() => nav.navigate('Hire', { providerId: post.author.id })} style={{ paddingVertical: 7, paddingHorizontal: 14 }} />
      </Pressable>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {post.images.map((uri) => (
          <Image key={uri} source={{ uri }} style={{ width: size, height: size, backgroundColor: colors.border }} resizeMode="cover" />
        ))}
      </ScrollView>
      <View style={{ padding: 12 }}>
        <Pressable onPress={() => onLike(post)} style={{ flexDirection: 'row', alignItems: 'center' }} hitSlop={8}>
          <Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={26} color={post.liked ? '#ef4444' : colors.text} />
          <Text style={{ marginLeft: 6, fontWeight: '600' }}>{post.likeCount}</Text>
          <Text style={{ marginLeft: 'auto', color: colors.muted, fontSize: 12 }}>{timeAgo(post.createdAt)}</Text>
        </Pressable>
        {post.caption ? (
          <Text style={{ marginTop: 8, color: colors.text }}>
            <Text style={{ fontWeight: '700' }}>{post.author.name} </Text>
            {post.caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const loadingMore = useRef(false);

  const load = useCallback(async (reset: boolean) => {
    try {
      const r = await api.get<{ posts: Post[]; nextCursor: string | null }>('/posts', { cursor: reset ? undefined : cursor ?? undefined });
      setPosts((prev) => (reset ? r.posts : [...prev, ...r.posts]));
      setCursor(r.nextCursor);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingMore.current = false;
    }
  }, [cursor]);

  const loadUnread = useCallback(async () => {
    try {
      const r = await api.get<{ unread: number }>('/notifications');
      setUnread(r.unread);
    } catch {
      /* badge only */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
      loadUnread();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );
  useSocketEvent('notification', () => setUnread((n) => n + 1));

  const like = async (p: Post) => {
    setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, liked: !x.liked, likeCount: x.likeCount + (x.liked ? -1 : 1) } : x)));
    try {
      await api.post(`/posts/${p.id}/like`);
    } catch {
      setPosts((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 6, paddingBottom: 10, paddingHorizontal: 16, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.primary, flex: 1 }}>SkillConnect</Text>
        <Pressable onPress={() => nav.navigate('CreatePost')} hitSlop={8} style={{ marginRight: 18 }}>
          <Ionicons name="add-circle-outline" size={28} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => {
            setUnread(0);
            nav.navigate('Notifications');
          }}
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={26} color={colors.text} />
          {unread > 0 ? (
            <View style={{ position: 'absolute', right: -6, top: -4, backgroundColor: colors.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PostCard post={item} onLike={like} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (cursor && !loadingMore.current) {
              loadingMore.current = true;
              load(false);
            }
          }}
          ListEmptyComponent={<Empty icon="images-outline" text="No posts yet. Use Explore to find people by skill, or share your own work with +." />}
        />
      )}
    </View>
  );
}
