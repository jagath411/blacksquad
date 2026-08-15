import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { Input } from '../components/ui';
import { colors } from '../constants/theme';
import { getHealth } from '../services/api/health';
import { ApiError } from '../services/api/client';
import { googleLogin, login, register } from '../services/authService';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
WebBrowser.maybeCompleteAuthSession();

export function LoginScreen({ route, navigation }: Props) {
  const [api, setApi] = useState('Checking API…'); const [createMode, setCreateMode] = useState(false); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  const isGoogleConfigured = Boolean(webClientId || androidClientId || iosClientId);
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({ webClientId, androidClientId, iosClientId });
  useEffect(() => { getHealth().then(() => setApi('Backend connected')).catch(() => setApi('Backend unavailable')); }, []);
  useEffect(() => { if (googleResponse?.type !== 'success' || !googleResponse.authentication?.idToken) return; setLoading(true); googleLogin(googleResponse.authentication.idToken, route.params.role).then(() => navigation.navigate('Home', { role: route.params.role })).catch(() => setError('Google sign-in could not be completed. Please try again.')).finally(() => setLoading(false)); }, [googleResponse, navigation, route.params.role]);
  const validEmail = email.includes('@') && email.includes('.'); const validForm = validEmail && password.length >= 8 && (!createMode || name.trim().length >= 2);
  const submit = async () => { if (!validForm) { setError(createMode ? 'Enter your name, a valid email, and an 8-character password.' : 'Enter a valid email and an 8-character password.'); return; } setError(''); setLoading(true); try { if (createMode) await register(name.trim(), email.trim(), password, route.params.role); else await login(email.trim(), password); navigation.navigate('Home', { role: route.params.role }); } catch (cause) { const status = cause instanceof ApiError ? cause.status : 0; const message = cause instanceof Error ? cause.message.toLowerCase() : ''; setError(status === 401 || message.includes('invalid email') ? 'Incorrect email or password. Create an account first if you are new.' : status === 409 || message.includes('already registered') ? 'This email is already registered. Switch to Sign in.' : status === 400 ? 'Please check the highlighted details and try again.' : cause instanceof Error ? cause.message : 'Unable to complete the request.'); } finally { setLoading(false); } };
  const googleEnabled = isGoogleConfigured && Boolean(googleRequest);
  return <Screen><View style={s.header}><Text style={s.kicker}>{route.params.role} PORTAL</Text><Text style={s.title}>{createMode ? 'Create your account.' : 'Welcome back.'}</Text><Text style={s.status}>{api}</Text></View><View style={s.form}><AppButton label="Continue with Google" variant="secondary" tone="dark" disabled={!googleEnabled || loading} onPress={() => promptGoogle()} /><Text style={s.divider}>OR USE EMAIL</Text>{createMode && <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" tone="dark"/>}<Input label="Email address" value={email} onChangeText={setEmail} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" tone="dark"/><Input label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoComplete={createMode ? 'new-password' : 'current-password'} tone="dark"/><AppButton label={createMode ? 'Create account' : 'Continue'} loading={loading} disabled={loading} onPress={submit}/>{!googleEnabled && <Text style={s.configHint}>Google sign-in is being configured for this environment.</Text>}{error && <View accessible accessibilityRole="alert" style={s.errorBox}><Text style={s.errorTitle}>We couldn’t continue</Text><Text style={s.errorText}>{error}</Text></View>}<Pressable accessibilityRole="button" onPress={() => { setCreateMode((value) => !value); setError(''); }}><Text style={s.switch}>{createMode ? 'Already have an account? Sign in' : 'New owner or driver? Create an account'}</Text></Pressable><Text style={s.note}>Secure authentication for your transport operations account.</Text></View></Screen>;
}
const s=StyleSheet.create<{header:ViewStyle;kicker:TextStyle;title:TextStyle;status:TextStyle;form:ViewStyle;divider:TextStyle;configHint:TextStyle;errorBox:ViewStyle;errorTitle:TextStyle;errorText:TextStyle;switch:TextStyle;note:TextStyle}>({header:{marginTop:60,marginBottom:48},kicker:{color:colors.green,fontSize:11,letterSpacing:2,fontWeight:'700'},title:{fontSize:42,color:colors.text,fontWeight:'800',marginTop:12},status:{color:colors.muted,marginTop:12},form:{gap:13},divider:{color:colors.muted,fontSize:11,letterSpacing:1.5,textAlign:'center',fontWeight:'700',marginVertical:2},configHint:{color:colors.muted,fontSize:12,textAlign:'center'},errorBox:{borderRadius:10,borderWidth:1,borderColor:'#F87171',backgroundColor:'#351719',padding:12,gap:4},errorTitle:{color:'#FCA5A5',fontWeight:'800',fontSize:13},errorText:{color:'#FECACA',fontSize:13,lineHeight:18},switch:{color:colors.green,textAlign:'center',fontWeight:'700',fontSize:13,paddingVertical:8},note:{color:colors.muted,fontSize:12,lineHeight:18,textAlign:'center',marginTop:5}});
