import React from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Icon } from '../components/ui/Icon';
import type { RootStackParamList, UserRole } from '../types';
import { fonts } from '../theme/fonts';
import { ink, line, brand, surface, text2, text3 } from '../theme/palette';

type Props = NativeStackScreenProps<RootStackParamList, 'Role'>;

interface RoleOption {
  role: UserRole;
  icon: string;
  iconFamily: 'ionicons' | 'material' | 'feather';
  title: string;
  description: string;
}

const ROLES: RoleOption[] = [
  {
    role: 'CUSTOMER',
    icon: 'car-sport',
    iconFamily: 'ionicons',
    title: 'Book a ride',
    description: 'See the price before you book and follow your driver on the map.',
  },
  {
    role: 'DRIVER',
    icon: 'steering',
    iconFamily: 'material',
    title: 'Drive with a fleet',
    description: 'Go online, accept rides near you and get paid by your fleet owner.',
  },
  {
    role: 'OWNER',
    icon: 'business',
    iconFamily: 'ionicons',
    title: 'Run a fleet',
    description: 'Add drivers and vehicles, see them live, and track earnings and costs.',
  },
];

export function RoleScreen({ navigation }: Props) {
  const select = (role: UserRole) => navigation.navigate('Login', { role });

  return (
    <Screen>
      <View style={s.header}>
        <Text style={s.title}>How will you use BlackSquad?</Text>
        <Text style={s.body}>You can sign in to the same account from any of these.</Text>
      </View>

      <View style={s.list}>
        {ROLES.map((item) => (
          <Pressable
            key={item.role}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => select(item.role)}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
          >
            <View style={s.iconBox}>
              <Icon name={item.icon} family={item.iconFamily} size={24} color="#FFFFFF" />
            </View>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>{item.title}</Text>
              <Text style={s.rowDesc}>{item.description}</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={text3} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create<{
  header: ViewStyle;
  title: TextStyle;
  body: TextStyle;
  list: ViewStyle;
  row: ViewStyle;
  rowPressed: ViewStyle;
  iconBox: ViewStyle;
  rowBody: ViewStyle;
  rowTitle: TextStyle;
  rowDesc: TextStyle;
}>({
  header: { paddingTop: 24, marginBottom: 28 },
  title: { fontFamily: fonts.w700, fontSize: 32, lineHeight: 36, color: ink, letterSpacing: -0.5 },
  body: { fontFamily: fonts.w400, fontSize: 16, lineHeight: 24, color: text2, marginTop: 10 },
  list: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: surface,
    borderWidth: 1,
    borderColor: line,
  },
  rowPressed: { borderColor: ink },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: brand, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: fonts.w700, fontSize: 19, color: ink },
  rowDesc: { fontFamily: fonts.w400, fontSize: 15, lineHeight: 21, color: text2, marginTop: 3 },
});
