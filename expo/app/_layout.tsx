import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { VineyardProvider } from "@/providers/VineyardProvider";
import { WeatherStationProvider } from "@/providers/WeatherStationProvider";
import { IndexReadingsProvider } from "@/providers/IndexReadingsProvider";
import { ProbeReadingsProvider } from "@/providers/ProbeReadingsProvider";
import { RecordsProvider } from "@/providers/RecordsProvider";
import { BlockSeasonsProvider } from "@/providers/BlockSeasonsProvider";
import { AlertsProvider } from "@/providers/AlertsProvider";
import { OfflineQueueProvider } from "@/providers/OfflineQueueProvider";
import { ScoutTasksProvider } from "@/providers/ScoutTasksProvider";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7,
      staleTime: 1000 * 60 * 5,
      retry: 2,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "VINEWATCH_RQ_CACHE_V1",
  throttleTime: 1000,
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthScreen = segments[0] === "login";

    if (!isAuthenticated && !inAuthScreen) {
      console.log("[AuthGate] Not authenticated, redirecting to login");
      router.replace("/login");
    } else if (isAuthenticated && inAuthScreen) {
      console.log("[AuthGate] Authenticated, redirecting to tabs");
      router.replace("/(tabs)/(dashboard)");
    }
  }, [isAuthenticated, isInitialized, segments, router]);

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <AuthGate>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="field-detail"
          options={{
            title: "Field Detail",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="index-detail"
          options={{
            title: "Index Detail",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="probe-detail"
          options={{
            title: "Probe Detail",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="add-field"
          options={{
            title: "Add Vineyard",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="add-probe"
          options={{
            title: "Add Probe",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="share-vineyard"
          options={{
            title: "Share Vineyard",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="vineyard-overlay"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
          }}
        />
        <Stack.Screen
          name="weather-station"
          options={{
            title: "Weather Station",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="vineyard-log"
          options={{
            title: "Activity Log",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="add-task"
          options={{
            title: "Log Task",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="add-phenology"
          options={{
            title: "Log Phenology",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="add-spray"
          options={{
            title: "Log Spray",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="add-harvest"
          options={{
            title: "Log Harvest",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="alerts"
          options={{
            title: "Alerts",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="notification-settings"
          options={{
            title: "Alert Settings",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="reports"
          options={{
            title: "Reports & Export",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="edit-block-profile"
          options={{
            title: "Block Profile",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="block-seasons"
          options={{
            title: "Seasons",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="scout-tasks"
          options={{
            title: "Scout Tasks",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="scout-task-detail"
          options={{
            title: "Inspection",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            gestureEnabled: false,
          }}
        />
      </Stack>
    </AuthGate>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        buster: "v1",
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <AuthProvider>
          <OfflineQueueProvider>
            <VineyardProvider>
              <WeatherStationProvider>
                <IndexReadingsProvider>
                  <ProbeReadingsProvider>
                    <RecordsProvider>
                      <BlockSeasonsProvider>
                        <AlertsProvider>
                          <ScoutTasksProvider>
                            <RootLayoutNav />
                          </ScoutTasksProvider>
                        </AlertsProvider>
                      </BlockSeasonsProvider>
                    </RecordsProvider>
                  </ProbeReadingsProvider>
                </IndexReadingsProvider>
              </WeatherStationProvider>
            </VineyardProvider>
          </OfflineQueueProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
