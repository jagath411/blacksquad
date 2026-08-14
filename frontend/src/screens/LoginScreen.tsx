import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { Input } from '../components/ui';
import { colors } from '../constants/theme';
import { getHealth } from '../services/api/health';
import { login } from '../services/authService';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
export function LoginScreen({ route, navigation }: Props) {
  const [api, setApi] = useState('Checking API…'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => { getHealth().then(() => setApi('Backend connected')).catch(() => setApi('Backend unavailable')); }, []);
  const submit = async () => { setError(''); setLoading(true); try { await login(email, password); navigation.navigate('Home', { role: route.params.role }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in'); } finally { setLoading(false); } };
  return <Screen><View style={s.header}><Text style={s.kicker}>{route.params.role} PORTAL</Text><Text style={s.title}>Welcome back.</Text><Text style={s.status}>{api}</Text></View><View style={s.form}><Input label="Email address" value={email} onChangeText={setEmail} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" tone="dark"/><Input label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry autoComplete="current-password" tone="dark" error={error}/><AppButton label="Continue" loading={loading} disabled={!email||password.length<8} onPress={submit}/><Text style={s.note}>Use your secure transport account to connect live tracking.</Text></View></Screen>;
}
const s=StyleSheet.create<{header:ViewStyle;kicker:TextStyle;title:TextStyle;status:TextStyle;form:ViewStyle;note:TextStyle}>({header:{marginTop:60,marginBottom:48},kicker:{color:colors.green,fontSize:11,letterSpacing:2,fontWeight:'700'},title:{fontSize:42,color:colors.text,fontWeight:'800',marginTop:12},status:{color:colors.muted,marginTop:12},form:{gap:13},note:{color:colors.muted,fontSize:12,lineHeight:18,textAlign:'center',marginTop:5}});
