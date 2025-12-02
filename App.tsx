// App.tsx
import React, { useEffect } from "react";
import { StatusBar, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "./src/screens/HomeScreen";
import notifee from "@notifee/react-native";

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
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={styles.container}>
        <HomeScreen />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });

export default App;
