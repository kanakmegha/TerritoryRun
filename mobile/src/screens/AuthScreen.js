import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useGameStore } from '../hooks/useGameStore';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.overlay}>
          {isLogin ? 
            <Login onSwitch={() => setIsLogin(false)} /> : 
            <Signup onSwitch={() => setIsLogin(true)} />
          }
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const Login = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useGameStore();

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await login({ email, password });
      if (!result.success) {
          setError(result.message);
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.authContainer}>
      <Text style={styles.title}>SYSTEM ACCESS</Text>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput 
              style={styles.input}
              value={email} 
              onChangeText={setEmail} 
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#666"
          />
      </View>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput 
              style={styles.input}
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry={true}
              placeholderTextColor="#666"
          />
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <TouchableOpacity 
        style={styles.cyberBtn} 
        onPress={handleSubmit} 
        disabled={loading}
      >
          {loading ? <ActivityIndicator color="#00f3ff" /> : <Text style={styles.btnText}>LOGIN</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={onSwitch} style={styles.switchWrapper}>
        <Text style={styles.switchText}>
          New Runner? <Text style={styles.switchLink}>Initialize Protocol</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const Signup = ({ onSwitch }) => {
  const [formData, setFormData] = useState({
      username: '',
      email: '',
      password: '',
      color: '#00f3ff'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useGameStore();

  const handleChange = (name, value) => {
      setFormData({...formData, [name]: value});
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signup(formData);
      if (!result.success) {
          setError(result.message);
      }
    } catch (err) {
      setError('Registration failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.authContainer}>
      <Text style={styles.title}>NEW IDENTITY</Text>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Codename (Username)</Text>
          <TextInput 
              style={styles.input}
              value={formData.username} 
              onChangeText={(val) => handleChange('username', val)} 
              autoCapitalize="none"
          />
      </View>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput 
              style={styles.input}
              value={formData.email} 
              onChangeText={(val) => handleChange('email', val)} 
              keyboardType="email-address"
              autoCapitalize="none"
          />
      </View>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput 
              style={styles.input}
              value={formData.password} 
              onChangeText={(val) => handleChange('password', val)} 
              secureTextEntry={true}
          />
      </View>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Neon Signature (Hex Color)</Text>
          <TextInput 
              style={styles.input}
              value={formData.color} 
              onChangeText={(val) => handleChange('color', val)} 
              autoCapitalize="none"
          />
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <TouchableOpacity 
        style={styles.cyberBtn} 
        onPress={handleSubmit} 
        disabled={loading}
      >
          {loading ? <ActivityIndicator color="#00f3ff" /> : <Text style={styles.btnText}>INITIALIZE</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={onSwitch} style={styles.switchWrapper}>
        <Text style={styles.switchText}>
          Already an agent? <Text style={styles.switchLink}>Access System</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContainer: {
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    padding: 20,
    borderWidth: 1,
    borderColor: '#00f3ff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    color: '#00f3ff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 2,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#00f3ff',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#00f3ff',
    color: 'white',
  },
  cyberBtn: {
    backgroundColor: 'transparent',
    borderColor: '#00f3ff',
    borderWidth: 1,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: {
    color: '#00f3ff',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  switchWrapper: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: '#888',
    fontSize: 14,
  },
  switchLink: {
    color: '#ff00ff',
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#ff3333',
    marginBottom: 10,
    textAlign: 'center',
  }
});
