import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import {
  SIGN_IN_STATES,
  executeSignInFlow,
  executeVerificationFlow,
  parseClerkAuthError,
} from '../utils/authFlow.js';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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

const logAuthStage = (stageNum, details) => {
  console.log(`[AuthTrace] Stage ${stageNum}:`, details);
};

const Login = ({ onSwitch }) => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [signInState, setSignInState] = useState(SIGN_IN_STATES.IDLE);
  const [verificationCode, setVerificationCode] = useState('');
  const [factorInfo, setFactorInfo] = useState(null);
  const [error, setError] = useState(null);

  const isSigningIn = signInState === SIGN_IN_STATES.SIGNING_IN;

  const handleSubmit = async () => {
    if (!isLoaded || isSigningIn) return;

    setError(null);
    setSignInState(SIGN_IN_STATES.SIGNING_IN);

    const result = await executeSignInFlow({
      signIn,
      setActive,
      identifier,
      password,
      onStage: logAuthStage,
    });

    if (result.success) {
      setSignInState(SIGN_IN_STATES.SIGNED_IN);
      return;
    }

    if (result.state === SIGN_IN_STATES.AWAITING_VERIFICATION) {
      setFactorInfo(result);
      setSignInState(SIGN_IN_STATES.AWAITING_VERIFICATION);
      return;
    }

    // Recoverable error
    setError(result.error?.message || 'Login failed. Please try again.');
    setSignInState(SIGN_IN_STATES.RECOVERABLE_ERROR);
  };

  const handleVerifyFactor = async () => {
    if (!isLoaded || isSigningIn) return;

    setError(null);
    setSignInState(SIGN_IN_STATES.SIGNING_IN);

    const result = await executeVerificationFlow({
      signIn,
      setActive,
      code: verificationCode,
      factorType: factorInfo?.factorType,
      strategy: factorInfo?.strategy,
      onStage: logAuthStage,
    });

    if (result.success) {
      setSignInState(SIGN_IN_STATES.SIGNED_IN);
      return;
    }

    if (result.state === SIGN_IN_STATES.AWAITING_VERIFICATION) {
      setError(result.error?.message || 'Verification failed. Please try again.');
      setSignInState(SIGN_IN_STATES.AWAITING_VERIFICATION);
      return;
    }

    setError(result.error?.message || 'Verification failed. Please try again.');
    setSignInState(SIGN_IN_STATES.RECOVERABLE_ERROR);
  };

  const handleCancelVerification = () => {
    setSignInState(SIGN_IN_STATES.IDLE);
    setVerificationCode('');
    setFactorInfo(null);
    setError(null);
  };

  if (signInState === SIGN_IN_STATES.AWAITING_VERIFICATION) {
    return (
      <View style={styles.authContainer}>
        <Text style={styles.title}>SECURITY VERIFICATION</Text>
        <Text style={styles.infoText}>
          {factorInfo?.message || 'Enter your authentication code to proceed.'}
        </Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Authentication Code</Text>
          <TextInput
            style={styles.input}
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            autoCapitalize="none"
            placeholder="123456"
            placeholderTextColor="#444"
            editable={!isSigningIn}
          />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.cyberBtn, isSigningIn && styles.btnDisabled]}
          onPress={handleVerifyFactor}
          disabled={isSigningIn}
        >
          {isSigningIn ? (
            <ActivityIndicator color="#00f3ff" />
          ) : (
            <Text style={styles.btnText}>CONFIRM CODE</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCancelVerification} style={styles.switchWrapper}>
          <Text style={styles.switchText}>
            Wrong Channel? <Text style={styles.switchLink}>Back to Access Protocol</Text>
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.authContainer}>
      <Text style={styles.title}>SYSTEM ACCESS</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email or username</Text>
        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholderTextColor="#444"
          placeholder="name@example.com or username"
          editable={!isSigningIn}
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
          editable={!isSigningIn}
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.cyberBtn, (isSigningIn || !isLoaded) && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={isSigningIn || !isLoaded}
        accessibilityRole="button"
      >
        {isSigningIn ? (
          <ActivityIndicator color="#00f3ff" />
        ) : (
          <Text style={styles.btnText}>
            {signInState === SIGN_IN_STATES.RECOVERABLE_ERROR ? 'RETRY CONNECTION' : 'ESTABLISH CONNECTION'}
          </Text>
        )}
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
    if (!isLoaded || loading) return;
    setLoading(true);
    setError('');
    try {
      await signUp.create({
        emailAddress: formData.email.trim(),
        password: formData.password,
        username: formData.username.trim(),
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (err) {
      const parsed = parseClerkAuthError(err);
      console.warn('[Signup] create failed', { code: parsed.code, status: parsed.status });
      setError(parsed.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || loading) return;
    setLoading(true);
    setError('');
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (completeSignUp?.status === 'complete' && completeSignUp.createdSessionId) {
        await setActive({ session: completeSignUp.createdSessionId });
      } else {
        setError('Verification incomplete. Please check the code.');
      }
    } catch (err) {
      const parsed = parseClerkAuthError(err);
      console.warn('[Signup] verify failed', { code: parsed.code, status: parsed.status });
      setError(parsed.message || 'Verification failed');
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
            editable={!loading}
          />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.cyberBtn, loading && styles.btnDisabled]}
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
          editable={!loading}
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
          editable={!loading}
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
          editable={!loading}
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.cyberBtn, (loading || !isLoaded) && styles.btnDisabled]}
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
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 25,
    letterSpacing: 3,
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
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
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
  btnDisabled: {
    opacity: 0.5,
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
  errorBox: {
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#ff3333',
    padding: 10,
    marginBottom: 10,
    marginTop: 5,
  },
  errorText: {
    color: '#ff6666',
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
