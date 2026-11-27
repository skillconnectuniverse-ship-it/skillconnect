import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Tabs: undefined;
  Profile: { userId: string };
  EditProfile: undefined;
  SkillEditor: undefined;
  CreatePost: undefined;
  Hire: { providerId: string; skillId?: string };
  Payment: { bookingId: string };
  BookingDetail: { bookingId: string };
  Chat: { userId: string; name: string };
  Notifications: undefined;
};

export type TabParamList = {
  Feed: undefined;
  Explore: { q?: string } | undefined;
  Bookings: undefined;
  Messages: undefined;
  Me: undefined;
};

export const useNav = () => useNavigation<NativeStackNavigationProp<RootStackParamList>>();
