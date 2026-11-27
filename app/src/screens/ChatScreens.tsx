import React, { useCallback, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../auth';
import { RootStackParamList, useNav } from '../nav';
import { colors } from '../theme';
import { Avatar, Empty, Loading, StatusDot } from '../ui';
import { ChatMessage, Conversation } from '../types';
import { timeAgo } from '../utils';
import { useSocketEvent } from '../realtime';

export function ChatsScreen() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ conversations: Conversation[] }>('/chat/conversations');
      setItems(r.conversations);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  useSocketEvent('message', load);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontSize: 22, fontWeight: '900' }}>Messages</Text>
      </View>
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.user.id}
          ListEmptyComponent={<Empty icon="chatbubbles-outline" text="No conversations yet. Open someone's profile and tap Message." />}
          renderItem={({ item }) => (
            <Pressable onPress={() => nav.navigate('Chat', { userId: item.user.id, name: item.user.name })} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.border }}>
              <View style={{ alignSelf: 'flex-start' }}>
                <Avatar uri={item.user.avatar} name={item.user.name} size={50} />
                <View style={{ position: 'absolute', right: -1, bottom: -1 }}>
                  <StatusDot status={item.user.status} size={14} />
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '800' }}>{item.user.name}</Text>
                <Text style={{ color: item.unread ? colors.text : colors.muted, fontWeight: item.unread ? '700' : '400' }} numberOfLines={1}>
                  {item.lastMessage.text}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{timeAgo(item.lastMessage.createdAt)}</Text>
                {item.unread ? (
                  <View style={{ marginTop: 4, backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{item.unread}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

export function ChatScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ messages: ChatMessage[] }>(`/chat/${params.userId}`);
      setMessages(r.messages);
    } finally {
      setLoading(false);
    }
  }, [params.userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useSocketEvent<ChatMessage>('message', (m) => {
    if (m.from === params.userId) {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      api.get(`/chat/${params.userId}`).catch(() => {});
    }
  });

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      const r = await api.post<{ message: ChatMessage }>(`/chat/${params.userId}`, { text: body });
      setMessages((prev) => [...prev, r.message]);
    } catch {
      setText(body);
    }
  };

  if (loading) return <Loading />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Empty icon="chatbubble-outline" text="Say hello!" />}
        renderItem={({ item }) => {
          const mine = item.from === user!.id;
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: mine ? colors.primary : '#fff', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9, marginBottom: 6, borderWidth: mine ? 0 : 1, borderColor: colors.border }}>
              <Text style={{ color: mine ? '#fff' : colors.text }}>{item.text}</Text>
              <Text style={{ color: mine ? '#ffffffaa' : colors.muted, fontSize: 10, marginTop: 2, alignSelf: 'flex-end' }}>{timeAgo(item.createdAt)}</Text>
            </View>
          );
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: colors.border }}>
        <TextInput value={text} onChangeText={setText} placeholder="Message" placeholderTextColor="#9ca3af" style={{ flex: 1, backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 }} onSubmitEditing={send} maxLength={2000} />
        <Pressable onPress={send} style={{ marginLeft: 8, backgroundColor: colors.primary, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
