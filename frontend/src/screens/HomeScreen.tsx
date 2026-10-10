import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { logout } from '../services/authService';
import type { RootStackParamList } from '../types';
import { CustomerHomeScreen } from './home/CustomerHomeScreen';
import { DriverHomeScreen } from './home/DriverHomeScreen';
import { OwnerHomeScreen } from './home/OwnerHomeScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/** Shows the home screen for the signed-in user's role. */
export function HomeScreen({ route, navigation }: Props) {
  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Role' }] });
  };
  const onLogout = () => void handleLogout();

  switch (route.params.role) {
    case 'DRIVER':
      return <DriverHomeScreen onLogout={onLogout} />;
    case 'OWNER':
      return <OwnerHomeScreen onLogout={onLogout} />;
    default:
      return <CustomerHomeScreen onLogout={onLogout} />;
  }
}
