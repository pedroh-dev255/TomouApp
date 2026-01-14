// App.tsx (simplificado)
import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  BatteryOptEnabled,
  OpenOptimizationSettings,
  RequestDisableOptimization,
} from 'react-native-battery-optimization-check';
import { Platform, Alert, Linking } from 'react-native';


// Navegação
import { NavigationContainer, DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Serviços
import { initializeChannels } from './src/services/notificationService';
import { loadSettings } from './src/utils/storage';

// Telas
import HomeScreen from "./src/screens/HomeScreen";
import ConfigsScreen from "./src/screens/ConfigsScreen";
import ReleasesScreen from "./src/screens/ReleasesScreen";
import DebugScreen from './src/screens/DebugScreen';

interface Settings {
  theme?: boolean;
}

const Stack = createNativeStackNavigator();

function App() {
  const colorScheme = useColorScheme();
  const [settings, setSettings] = useState<Settings>({});

  useEffect(() => {
    checkBatterySaver();
    const loadAppSettings = async () => {
      try {
        const s = await loadSettings();
        setSettings(s);
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      }
    };
    
    loadAppSettings();
    initializeChannels();
  }, []);

  async function checkBatterySaver() {
    if (Platform.OS === 'android') {
      const isOptimized = await BatteryOptEnabled();
      if (isOptimized) {
        await Alert.alert(
          'Economia de bateria ativa',
          'Para notificações funcionarem corretamente, desative o modo de economia de bateria para este app.'
        );

        await RequestDisableOptimization();
      }
    }
  }

  const isDarkMode = settings.theme ?? colorScheme === 'dark';

  // Tema de navegação
  const navTheme: Theme = isDarkMode
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: '#4f46e5',
          background: '#121212',
          card: '#1e1e1e',
          text: '#ffffff',
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: '#4f46e5',
          background: '#f3f4f6',
          card: '#ffffff',
          text: '#1f2937',
        },
      };

  return (
    <SafeAreaProvider style={isDarkMode ? darkStyles.container : styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator 
          initialRouteName="Home"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Configs" component={ConfigsScreen} />
          <Stack.Screen name="Releases" component={ReleasesScreen} />
          <Stack.Screen name="Debug" component={DebugScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40
  }
});

const darkStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000ff',
    paddingTop: 40
  }
});

export default App;