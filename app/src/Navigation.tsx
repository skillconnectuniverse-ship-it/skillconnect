import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './auth';
import { colors } from './theme';
import { Loading } from './ui';
import { RootStackParamList, TabParamList } from './nav';
import { LoginScreen, RegisterScreen, ForgotPasswordScreen } from './screens/AuthScreens';
import VerifyScreen from './screens/VerifyScreen';
import WalletScreen from './screens/WalletScreen';
import KycScreen from './screens/KycScreen';
import { ReportScreen, SupportScreen, ComplaintScreen } from './screens/SupportScreens';
import AdminScreen from './screens/AdminScreen';
import FeedScreen from './screens/FeedScreen';
import ExploreScreen from './screens/ExploreScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import SkillEditorScreen from './screens/SkillEditorScreen';
import CreatePostScreen from './screens/CreatePostScreen';
import HireScreen from './screens/HireScreen';
import PaymentScreen from './screens/PaymentScreen';
import BookingsScreen from './screens/BookingsScreen';
import BookingDetailScreen from './screens/BookingDetailScreen';
import { ChatsScreen, ChatScreen } from './screens/ChatScreens';
import NotificationsScreen from './screens/NotificationsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Feed: ['home', 'home-outline'],
  Explore: ['search', 'search-outline'],
  Bookings: ['briefcase', 'briefcase-outline'],
  Messages: ['chatbubbles', 'chatbubbles-outline'],
  Me: ['person-circle', 'person-circle-outline'],
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Messages" component={ChatsScreen} />
      <Tab.Screen name="Me" component={MyProfile} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

function MyProfile() {
  const { user } = useAuth();
  return <ProfileScreen userIdOverride={user!.id} />;
}

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary } };

export default function Navigation() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerTintColor: colors.text, headerBackTitle: 'Back' }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset password' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit profile' }} />
            <Stack.Screen name="SkillEditor" component={SkillEditorScreen} options={{ title: 'My skills & prices' }} />
            <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ title: 'New post' }} />
            <Stack.Screen name="Hire" component={HireScreen} options={{ title: 'Hire' }} />
            <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
            <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking' }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params.name })} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
            <Stack.Screen name="Verify" component={VerifyScreen} options={{ title: 'Verify account' }} />
            <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet & withdrawals' }} />
            <Stack.Screen name="Kyc" component={KycScreen} options={{ title: 'Identity verification' }} />
            <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Report a problem' }} />
            <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Support & complaints' }} />
            <Stack.Screen name="Complaint" component={ComplaintScreen} options={{ title: 'Complaint' }} />
            <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin panel' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
