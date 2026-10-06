// Main App entry point for Thufu Deploy mobile app
// Lives at thufu-deploy/mobile/App.tsx — direct entry point (no expo/AppEntry.js)
// All paths relative to mobile/ directory

// Polyfill: In JSC, 'window' is NOT automatically a globalThis property.
// Metro's runtime code does 'typeof window !== undefined' which would crash without this.
// Setting globalThis.window = globalThis makes 'window' and 'globalThis' equivalent.
(globalThis as unknown as { window: typeof globalThis }).window = globalThis;
(globalThis as unknown as { location: typeof globalThis.location }).location = {
  href: 'https://localhost',
  hostname: 'localhost',
  pathname: '/',
  protocol: 'https:',
  origin: 'https://localhost',
};

import React, { Component, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

// ErrorBoundary catches JS errors and shows a visible screen instead of crashing silently
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message + '\n\n' + (error.stack || '') };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>App Error</Text>
          <Text style={styles.errorText}>{this.state.errorMessage}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('thufu_token')
      .then(token => setIsAuthenticated(!!token))
      .catch(() => setIsAuthenticated(false));
  }, []);

  if (isAuthenticated === null) {
    // Loading — return null to show nothing (splash screen handles this)
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

export default function App() {
  return (
    <ErrorBoundary>
      <AppNavigator />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
