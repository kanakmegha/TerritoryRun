import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';

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
  const { signIn, setActive, isLoaded } = useSignIn();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      const completeSignIn = await signIn.create({
        identifier: username,
        password,
      });
      await setActive({ session: completeSignIn.createdSessionId });
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      setError(err.errors?.[0]?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.authContainer}>
      <Text style={styles.title}>SYSTEM ACCESS</Text>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Codename</Text>
          <TextInput 
              style={styles.input}
              value={username} 
              onChangeText={setUsername} 
              autoCapitalize="none"
              placeholderTextColor="#444"
              placeholder="ghost_runner"
          />
      </View>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Security Key</Text>
          <TextInput 
              style={styles.input}
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry={true}
              placeholderTextColor="#444"
              placeholder="••••••••"
          />
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <TouchableOpacity 
        style={styles.cyberBtn} 
        onPress={handleSubmit} 
        disabled={loading || !isLoaded}
      >
          {loading ? <ActivityIndicator color="#00f3ff" /> : <Text style={styles.btnText}>ESTABLISH CONNECTION</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={onSwitch} style={styles.switchWrapper}>
        <Text style={styles.switchText}>
          Unauthorized Signal? <Text style={styles.switchLink}>Initialize New Protocol</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const Signup = ({ onSwitch }) => {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [step, setStep] = useState('input'); // 'input' | 'verify'
  const [formData, setFormData] = useState({
      username: '',
      email: '',
      password: '',
  });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
        username: formData.username,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      setError(err.errors?.[0]?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });
      await setActive({ session: completeSignUp.createdSessionId });
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      setError(err.errors?.[0]?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verify') {
      return (
        <View style={styles.authContainer}>
            <Text style={styles.title}>VERIFY UPLINK</Text>
            <Text style={styles.infoText}>A verification code was sent to {formData.email}.</Text>
            
            <View style={styles.formGroup}>
                <Text style={styles.label}>Authentication Code</Text>
                <TextInput 
                    style={styles.input}
                    value={code} 
                    onChangeText={setCode} 
                    keyboardType="number-pad"
                    placeholder="123456"
                    placeholderTextColor="#444"
                />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity 
                style={styles.cyberBtn} 
                onPress={handleVerify} 
                disabled={loading}
            >
                {loading ? <ActivityIndicator color="#00f3ff" /> : <Text style={styles.btnText}>CONFIRM IDENTITY</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('input')} style={styles.switchWrapper}>
                <Text style={styles.switchText}>Wrong Channel? <Text style={styles.switchLink}>Re-initialize</Text></Text>
            </TouchableOpacity>
        </View>
      );
  }

  return (
    <View style={styles.authContainer}>
      <Text style={styles.title}>NEW IDENTITY</Text>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Codename</Text>
          <TextInput 
              style={styles.input}
              value={formData.username} 
              onChangeText={(val) => setFormData({...formData, username: val})} 
              autoCapitalize="none"
              placeholder="GhostRunner"
              placeholderTextColor="#444"
          />
      </View>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput 
              style={styles.input}
              value={formData.email} 
              onChangeText={(val) => setFormData({...formData, email: val})} 
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="runner@nexus.com"
              placeholderTextColor="#444"
          />
      </View>
      
      <View style={styles.formGroup}>
          <Text style={styles.label}>Security Key</Text>
          <TextInput 
              style={styles.input}
              value={formData.password} 
              onChangeText={(val) => setFormData({...formData, password: val})} 
              secureTextEntry={true}
              placeholder="••••••••"
              placeholderTextColor="#444"
          />
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <TouchableOpacity 
        style={styles.cyberBtn} 
        onPress={handleSubmit} 
        disabled={loading || !isLoaded}
      >
          {loading ? <ActivityIndicator color="#00f3ff" /> : <Text style={styles.btnText}>INITIALIZE PROTOCOL</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={onSwitch} style={styles.switchWrapper}>
        <Text style={styles.switchText}>
          Existing Agent? <Text style={styles.switchLink}>Signal Access System</Text>
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
    backgroundColor: 'rgba(5, 5, 5, 0.95)',
    padding: 25,
    borderWidth: 2,
    borderColor: '#00f3ff',
    borderRadius: 2,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#00f3ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    color: '#00f3ff',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 25,
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 243, 255, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#00f3ff',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
    opacity: 0.8,
  },
  infoText: {
      color: '#aaa',
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 20,
      fontStyle: 'italic',
  },
  input: {
    width: '100%',
    padding: 14,
    backgroundColor: 'rgba(20, 20, 20, 0.8)',
    borderWidth: 1,
    borderColor: '#222',
    borderLeftWidth: 4,
    borderLeftColor: '#00f3ff',
    color: 'white',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cyberBtn: {
    backgroundColor: 'rgba(0, 243, 255, 0.1)',
    borderColor: '#00f3ff',
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#00f3ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  btnText: {
    color: '#00f3ff',
    fontWeight: 'bold',
    letterSpacing: 3,
    fontSize: 14,
  },
  switchWrapper: {
    marginTop: 25,
    alignItems: 'center',
  },
  switchText: {
    color: '#444',
    fontSize: 12,
    letterSpacing: 1,
  },
  switchLink: {
    color: '#ff00ff',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff3333',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  }
});
