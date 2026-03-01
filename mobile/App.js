import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GameProvider, useGameStore } from './src/hooks/useGameStore';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

import AuthScreen from './src/screens/AuthScreen';
import GameScreen from './src/screens/GameScreen';
import CommandCenter from './src/screens/CommandCenter';
import RouteSuggestion from './src/screens/RouteSuggestion';
import ActiveRun from './src/screens/ActiveRun';
import ConquestSummary from './src/screens/ConquestSummary';

const CLERK_PUBLISHABLE_KEY =process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
console.log("🔑 Clerk Key Loaded:", CLERK_PUBLISHABLE_KEY ? "Success" : "MISSING!");
/* 🔥 CRITICAL FIX — Proper persistent session storage for Clerk */
const tokenCache = {
  async getToken(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      return null;
    }
  },

  async saveToken(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {}
  },

  async clearToken(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {}
  },
};

const Stack = createNativeStackNavigator();

/* ---------------- Error Boundary ---------------- */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errStyles.container}>
          <Text style={errStyles.title}>⚠️ Render Error</Text>
          <Text style={errStyles.msg}>{this.state.error?.message}</Text>
          <TouchableOpacity
            style={errStyles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={errStyles.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { color: '#ff4444', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  msg: { color: '#fff', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: '#00f3ff', padding: 15, borderRadius: 8 },
  btnText: { color: '#000', fontWeight: 'bold' },
});

/* ---------------- Navigation ---------------- */

const RootNavigator = () => {
  const { token, startGpsTracking } = useGameStore();

  React.useEffect(() => {
    if (token) {
      console.log("GPS starting because token exists");
      startGpsTracking();
    }
  }, [token]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main">
        {() => (
          <>
            <SignedIn>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="CommandCenter" component={CommandCenter} />
                <Stack.Screen name="RouteSuggestion" component={RouteSuggestion} />
                <Stack.Screen name="Game" component={GameScreen} />
                <Stack.Screen name="ActiveRun" component={ActiveRun} />
                <Stack.Screen name="ConquestSummary" component={ConquestSummary} />
              </Stack.Navigator>
            </SignedIn>

            <SignedOut>
              <AuthScreen />
            </SignedOut>
          </>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

/* ---------------- Main App ---------------- */

export default function App() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ErrorBoundary>
        <SafeAreaProvider>
          <GameProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </GameProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </ClerkProvider>
  );
}