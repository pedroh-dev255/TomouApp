// App.tsx
import React, { useEffect } from "react";
import { StatusBar, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import notifee from "@notifee/react-native";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Importação das telas
import HomeScreen     from "./src/screens/HomeScreen";
import ReleasesScreen from "./src/screens/ReleasesScreen";
import DebugScreen from './src/screens/DebugScreen';

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

  useEffect(() => {
    bootstrap();
  }, []);

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Home"
          screenOptions={{ 
            headerShown: false 
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          
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
              options={{ title: 'Debug' }} 
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
});

export default App;