import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GameProvider, useGameStore } from './src/hooks/useGameStore';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthScreen from './src/screens/AuthScreen';
import GameScreen from './src/screens/GameScreen';
import CommandCenter from './src/screens/CommandCenter';

import RouteSuggestion from './src/screens/RouteSuggestion';
import ActiveRun from './src/screens/ActiveRun';
import ConquestSummary from './src/screens/ConquestSummary';

const Stack = createNativeStackNavigator();

// Global error boundary to catch rendering crashes and show a helpful message
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

const RootNavigator = () => {
  const { token, startGpsTracking } = useGameStore();
  
  React.useEffect(() => {
    if (token) {
      startGpsTracking();
    }
  }, [token]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!token ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="CommandCenter" component={CommandCenter} />
          <Stack.Screen name="RouteSuggestion" component={RouteSuggestion} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="ActiveRun" component={ActiveRun} />
          <Stack.Screen name="ConquestSummary" component={ConquestSummary} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GameProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </GameProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
