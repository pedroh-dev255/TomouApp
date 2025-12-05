// App.tsx
import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import notifee from "@notifee/react-native";
// Importações de Navegação
import { NavigationContainer, DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from "@react-native-async-storage/async-storage";

// Importação das telas
import HomeScreen     from "./src/screens/HomeScreen";
import ConfigsScreen  from "./src/screens/ConfigsScreen";
import ReleasesScreen from "./src/screens/ReleasesScreen";
import DebugScreen    from './src/screens/DebugScreen';

const SETTINGS = "@tomou:settings";

interface AppSettings {
  theme?: boolean;
}

// Define o Stack Navigator
const Stack = createNativeStackNavigator();

async function bootstrap() {
  try {
    await notifee.createChannel({
      id: "alarme",
      name: "Tomou Alarmes",
      sound: "alarme",
      importance: 4,
      vibration: true,
    });

    console.log("Channels created no app");
  } catch (e) {
    console.warn("bootstrap notifee", e);
  }
}

function App() {
  const colorScheme = useColorScheme();
  const [settings, setSettings] = useState<AppSettings>({});

  useEffect(() => {
    const loadSettings = async () => {
        try {
          const s = await AsyncStorage.getItem(SETTINGS);
          if (s) {
            setSettings(JSON.parse(s));
          }
        } catch (error) {
          console.error("Erro ao carregar configurações:", error);
        }
    };
    loadSettings();
  }, []);

  const isDarkMode = settings.theme ?? colorScheme === 'dark';

  useEffect(() => {
    bootstrap();
  }, []);
  
  // 1. Define o tema de navegação personalizado (Customizing the Navigation Theme)
  const navTheme: Theme = isDarkMode
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: '#4f46e5', // Cor primária (ícones, botões)
          background: '#121212', // Fundo principal da tela (sempre #121212 para tema dark)
          card: '#1e1e1e', // Cor de fundo dos cabeçalhos e elementos de navegação
          text: '#ffffff', // Cor padrão do texto
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: '#4f46e5',
          background: '#f3f4f6', // Fundo principal da tela (#f3f4f6 para tema light)
          card: '#ffffff', // Cor de fundo dos cabeçalhos
          text: '#1f2937', // Cor padrão do texto
        },
      };

  return (
    <SafeAreaProvider style={isDarkMode ? darkStyles.container : styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? navTheme.colors.card : navTheme.colors.card} />
      
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Home"
          screenOptions={{ 
            headerShown: false,
          }}
        >
        <Stack.Screen name="Home" component={HomeScreen} />

        <Stack.Screen 
          name="Configs" 
          component={ConfigsScreen} 
          options={{ title: 'Configs', headerShown: false }}
        />

        <Stack.Screen 
          name="Releases" 
          component={ReleasesScreen} 
          options={{ 
            title: 'Atualizações',
          }}
        />

        <Stack.Screen 
          name="Debug" 
          component={DebugScreen} 
          options={{ 
            title: 'Debug',
          }} 
        />

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