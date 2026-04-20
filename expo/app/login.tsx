import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Leaf, Mail, Lock, User, Eye, EyeOff, Play } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, signInWithGoogle, signInWithApple, enterDemoMode, isSigningIn, isSigningUp, isSigningInWithGoogle, isSigningInWithApple } = useAuth();
  const [isSignUpMode, setIsSignUpMode] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    if (isSignUpMode && !displayName.trim()) {
      Alert.alert('Missing Name', 'Please enter your display name.');
      return;
    }

    try {
      if (isSignUpMode) {
        await signUp(email.trim(), password, displayName.trim());
        Alert.alert('Account Created', 'Check your email to confirm your account, then sign in.');
        setIsSignUpMode(false);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      Alert.alert('Error', msg);
    }
  };

  const isLoading = isSigningIn || isSigningUp;

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Google sign-in failed';
      if (!msg.toLowerCase().includes('cancel')) {
        Alert.alert('Google Sign-In Failed', msg);
      }
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Apple sign-in failed';
      const lower = msg.toLowerCase();
      if (lower.includes('canceled') || lower.includes('cancelled') || lower.includes('err_request_canceled')) {
        return;
      }
      Alert.alert('Apple Sign-In Failed', msg);
    }
  };

  const showAppleButton = Platform.OS === 'ios' || Platform.OS === 'web';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroSection}>
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <Leaf size={32} color={Colors.primary} />
                </View>
              </View>
              <Text style={styles.appName}>VineWatch</Text>
              <Text style={styles.tagline}>Precision Vineyard Monitoring</Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formTitle}>
                {isSignUpMode ? 'Create Account' : 'Welcome Back'}
              </Text>
              <Text style={styles.formSubtitle}>
                {isSignUpMode
                  ? 'Sign up to start monitoring your vineyards'
                  : 'Sign in to access your vineyards'}
              </Text>

              {isSignUpMode && (
                <View style={styles.inputContainer}>
                  <View style={styles.inputIcon}>
                    <User size={18} color={Colors.textMuted} />
                  </View>
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Display Name"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="words"
                    testID="displayName"
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Mail size={18} color={Colors.textMuted} />
                </View>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email Address"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  testID="email"
                />
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Lock size={18} color={Colors.textMuted} />
                </View>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  testID="password"
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={Colors.textMuted} />
                  ) : (
                    <Eye size={18} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  isLoading && styles.submitBtnDisabled,
                  pressed && !isLoading && styles.submitBtnPressed,
                ]}
                onPress={() => void handleSubmit()}
                disabled={isLoading}
                testID="submitBtn"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.background} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {isSignUpMode ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
              </Pressable>

              <View style={styles.switchRow}>
                <Text style={styles.switchText}>
                  {isSignUpMode ? 'Already have an account?' : "Don't have an account?"}
                </Text>
                <Pressable
                  onPress={() => {
                    setIsSignUpMode(!isSignUpMode);
                    setPassword('');
                  }}
                >
                  <Text style={styles.switchLink}>
                    {isSignUpMode ? 'Sign In' : 'Sign Up'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.googleBtn,
                  isSigningInWithGoogle && styles.submitBtnDisabled,
                  pressed && !isSigningInWithGoogle && styles.submitBtnPressed,
                ]}
                onPress={() => void handleGoogleSignIn()}
                disabled={isSigningInWithGoogle}
                testID="googleBtn"
              >
                {isSigningInWithGoogle ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <>
                    <Svg width={18} height={18} viewBox="0 0 48 48">
                      <Path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                      <Path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                      <Path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                      <Path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                    </Svg>
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              {showAppleButton && (
                <Pressable
                  style={({ pressed }) => [
                    styles.appleBtn,
                    isSigningInWithApple && styles.submitBtnDisabled,
                    pressed && !isSigningInWithApple && styles.submitBtnPressed,
                  ]}
                  onPress={() => void handleAppleSignIn()}
                  disabled={isSigningInWithApple}
                  testID="appleBtn"
                >
                  {isSigningInWithApple ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Svg width={18} height={22} viewBox="0 0 384 512">
                        <Path fill="#ffffff" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                      </Svg>
                      <Text style={styles.appleBtnText}>Continue with Apple</Text>
                    </>
                  )}
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.demoBtn,
                  pressed && styles.demoBtnPressed,
                ]}
                onPress={enterDemoMode}
                testID="demoBtn"
              >
                <Play size={16} color={Colors.primary} />
                <Text style={styles.demoBtnText}>Explore Demo</Text>
              </Pressable>
              <Text style={styles.demoHint}>No account needed — explore with sample vineyard data</Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Sentinel Hub · Copernicus STAC · Supabase</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  heroSection: {
    alignItems: 'center' as const,
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
  },
  appName: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  tagline: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500' as const,
    marginTop: 4,
  },
  formSection: {
    gap: 12,
  },
  formTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  formSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500' as const,
    height: '100%' as const,
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeBtn: {
    position: 'absolute' as const,
    right: 14,
    padding: 4,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitBtnText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  switchRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 8,
  },
  switchText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  switchLink: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  dividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.cardBorder,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  googleBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  googleBtnText: {
    color: '#1f1f1f',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  appleBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    borderColor: '#000000',
  },
  appleBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  demoBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primaryMuted,
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.25)',
  },
  demoBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  demoBtnText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  demoHint: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center' as const,
    marginTop: 4,
  },
  footer: {
    alignItems: 'center' as const,
    marginTop: 40,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
});
