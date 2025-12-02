import { AppRegistry } from "react-native";
import notifee from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Executado quando WidgetService dispara o JS
const WidgetTask = async () => {
  console.log("WidgetTask executado!");

  // Dados que você quer mostrar no widget
  const value = await AsyncStorage.getItem("info");

  // Enviar broadcast para atualizar o widget
  await notifee.displayNotification({
    title: "Widget atualizado",
    body: `Valor: ${value}`,
  });

  return null;
};

AppRegistry.registerHeadlessTask("WidgetTask", () => WidgetTask);
