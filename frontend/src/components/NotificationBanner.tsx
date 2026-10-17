import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { Icon } from './ui/Icon';
import { radius, spacing } from '../theme';
import { fonts } from '../theme/fonts';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface NotificationBannerProps {
  notification: NotificationItem | null;
  onDismiss: () => void;
}

export function NotificationBanner({ notification, onDismiss }: NotificationBannerProps) {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const type = notification.type || 'info';
  const colorMap = {
    success: '#1E8E5A',
    error: '#C8372D',
    warning: '#B7791F',
    info: '#2457D6',
  };
  const iconMap = {
    success: 'checkmark-circle',
    error: 'alert-circle',
    warning: 'warning',
    info: 'notifications',
  };

  const primaryColor = colorMap[type];
  const iconName = iconMap[type];

  return (
    <View style={styles.container}>
      <View style={[styles.banner, { borderColor: primaryColor }]}>
        <View style={[styles.iconBox, { backgroundColor: `${primaryColor}22` }]}>
          <Icon name={iconName} size={18} color={primaryColor} />
        </View>
        <View style={styles.textGroup}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.body}>{notification.body}</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={onDismiss}>
          <Icon name="close" size={16} color="#5B6573" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create<{
  container: ViewStyle;
  banner: ViewStyle;
  iconBox: ViewStyle;
  textGroup: ViewStyle;
  title: TextStyle;
  body: TextStyle;
  closeBtn: ViewStyle;
}>({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#172F8A',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    elevation: 8,
    shadowColor: '#D5DBE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(31, 63, 184, 0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
  },
  title: {
    color: '#1D232B',
    fontFamily: fonts.w700,
    fontSize: 13,
  },
  body: {
    color: '#5B6573',
    fontSize: 11, fontFamily: fonts.w400,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
});
