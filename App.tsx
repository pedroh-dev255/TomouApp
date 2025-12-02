// App.tsx
import React, { useEffect } from "react";
import { StatusBar, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import notifee from "@notifee/react-native";

// Importações do React Navigation
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Importação das telas
import HomeScreen     from "./src/screens/HomeScreen";
import ReleasesScreen from "./src/screens/ReleasesScreen"; // Certifique-se de que o caminho está correto

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
  const isDarkMode = useColorScheme() === "dark";

  // Roda bootstrap *apenas uma vez*
  useEffect(() => {
    bootstrap();
  }, []);

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      {/* 1. Container de Navegação */}
      <NavigationContainer>
        {/* 2. Stack Navigator */}
        <Stack.Navigator 
          initialRouteName="Home"
          // Oculta o cabeçalho padrão do React Navigation, já que você provavelmente
          // quer controlar o visual do cabeçalho dentro da HomeScreen
          screenOptions={{ 
            headerShown: false 
          }}
        >
          {/* 3. Tela Home (inclui o botão de navegação) */}
          <Stack.Screen name="Home" component={HomeScreen} />
          
          {/* 4. Tela de Releases (destino do botão) */}
          <Stack.Screen 
            name="Releases" 
            component={ReleasesScreen} 
            options={{ 
                headerShown: false, // Mostra o cabeçalho padrão para a tela Releases
                title: 'Atualizações',
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
    marginTop: 40,
  }
}); // Este estilo não é mais necessário no App.tsx

export default App;