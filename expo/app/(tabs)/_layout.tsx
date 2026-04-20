import { Tabs, useRouter } from "expo-router";
import { LayoutDashboard, MapPin, Satellite, Droplets, Settings } from "lucide-react-native";
import React, { useEffect } from "react";
import { View } from "react-native";
import Colors from "@/constants/colors";
import OfflineBanner from "@/components/OfflineBanner";
import { useAuth } from "@/providers/AuthProvider";
import { useVineyards } from "@/providers/VineyardProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "vinewatch_onboarded_v1";

export default function TabLayout() {
  const router = useRouter();
  const { user, isDemoMode, isInitialized } = useAuth();
  const { vineyards, isLoading } = useVineyards();

  useEffect(() => {
    if (!isInitialized) return;
    if (!user || isDemoMode) return;
    if (isLoading) return;
    (async () => {
      try {
        const done = await AsyncStorage.getItem(`${ONBOARDING_KEY}:${user.id}`);
        if (!done && vineyards.length === 0) {
          console.log("[Onboarding] first run, navigating");
          router.replace("/onboarding");
        }
      } catch (e) {
        console.log("[Onboarding] check error", e);
      }
    })();
  }, [user, isDemoMode, isInitialized, isLoading, vineyards.length, router]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <OfflineBanner />
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600' as const,
        },
      }}
    >
      <Tabs.Screen
        name="(dashboard)"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="fields"
        options={{
          title: "Fields",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="indices"
        options={{
          title: "Indices",
          tabBarIcon: ({ color, size }) => <Satellite color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="soil"
        options={{
          title: "Soil",
          tabBarIcon: ({ color, size }) => <Droplets color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
      </Tabs>
    </View>
  );
}
