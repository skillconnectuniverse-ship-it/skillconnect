import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth';
import Navigation from './src/Navigation';
import { CallProvider } from './src/call/CallProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CallProvider>
          <Navigation />
        </CallProvider>
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
