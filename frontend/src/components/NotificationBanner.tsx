import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { Icon } from './ui/Icon';
import { radius, spacing } from '../theme';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type?: 'info' | 'success' | 'warning';
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
    }, 4500);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <View style={styles.iconBox}>
          <Icon name="notifications" size={18} color="#00D084" />
        </View>
        <View style={styles.textGroup}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.body}>{notification.body}</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={onDismiss}>
          <Icon name="close" size={16} color="#64748B" />
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
    backgroundColor: '#0F172A',
    borderColor: '#00D084',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 208, 132, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 13,
  },
  body: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
});
