import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface TabItem {
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  matchPaths?: string[];
}

const TABS: TabItem[] = [
  { route: '/', icon: 'home-outline', activeIcon: 'home', label: 'Home' },
  { route: '/scanner', icon: 'scan-outline', activeIcon: 'scan', label: 'Scan' },
  { route: '/range', icon: 'locate-outline', activeIcon: 'locate', label: 'Range', matchPaths: ['/range'] },
  { route: '/outbox', icon: 'cloud-upload-outline', activeIcon: 'cloud-upload', label: 'Outbox' },
  { route: '/settings', icon: 'settings-outline', activeIcon: 'settings', label: 'Settings' },
];

export default function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (tab: TabItem) => {
    if (tab.route === '/' && pathname === '/') return true;
    if (tab.route !== '/' && pathname.startsWith(tab.route)) return true;
    if (tab.matchPaths) return tab.matchPaths.some(p => pathname.startsWith(p));
    return false;
  };

  // Don't show on deep screens or dedicated sub-tool workflows
  const deepScreens = [
    '/firearm/',
    '/ammo/',
    '/component/',
    '/voice-memos',
    '/locked',
    '/range/grouping-calculator',
    '/range/chronograph',
    '/range/ballistics',
    '/range/checklist',
    '/firearms/bill-of-sale',
  ];
  const isDeepScreen = deepScreens.some(s => pathname.startsWith(s));
  if (isDeepScreen) return null;

  const handlePress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <Pressable
              key={tab.route}
              style={styles.tabItem}
              onPress={() => handlePress(tab.route)}
            >
              <View style={[styles.iconWrapper, active && styles.iconWrapperActive]}>
                <Ionicons
                  name={active ? tab.activeIcon : tab.icon}
                  size={22}
                  color={active ? '#34d399' : '#64748b'}
                />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {active && <View style={styles.activeIndicator} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20, // Safe area
    paddingHorizontal: 12,
    pointerEvents: 'box-none',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  iconWrapper: {
    width: 40,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#34d399',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: -2,
    width: 16,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#34d399',
  },
});
