// Main App entry point for Thufu Deploy mobile app
// Lives at thufu-deploy/mobile/App.tsx — direct entry point (no expo/AppEntry.js)
// All paths relative to mobile/ directory

// CRITICAL: Set window BEFORE any module code runs. In JSC, 'window' is NOT
// automatically a globalThis property. Metro's runtime code at bundle position ~6247
// does 'typeof window !== undefined' which would crash without this.
// Setting globalThis.window = globalThis makes 'window' and 'globalThis' equivalent.
// This MUST run before any Metro/__r/require code, so it's at the very top.
(globalThis as unknown as { window: typeof globalThis }).window = globalThis;
(globalThis as unknown as { location: typeof globalThis.location }).location = {
  href: 'https://localhost',
  hostname: 'localhost',
  pathname: '/',
  protocol: 'https:',
  origin: 'https://localhost',
};

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SurveyListScreen from './src/screens/SurveyListScreen';
import SurveyFormScreen from './src/screens/SurveyFormScreen';
import SubmissionDetailScreen from './src/screens/SubmissionDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('thufu_token').then(token => {
      setIsAuthenticated(!!token);
    });
  }, []);

  if (isAuthenticated === null) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'Home' : 'Login'}
        screenOptions={{
          headerStyle: { backgroundColor: '#1e3a8a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Thufu Deploy' }} />
        <Stack.Screen name="SurveyList" component={SurveyListScreen} options={{ title: 'My Assignments' }} />
        <Stack.Screen name="SurveyForm" component={SurveyFormScreen} options={{ title: 'Audit Form' }} />
        <Stack.Screen name="SubmissionDetail" component={SubmissionDetailScreen} options={{ title: 'Submission' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
