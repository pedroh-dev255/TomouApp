import { AppRegistry } from 'react-native';
import notifee, { EventType, AndroidImportance } from "@notifee/react-native";
import App from './App';
import AsyncStorage from "@react-native-async-storage/async-storage";

import { name as appName } from './app.json';

const FOLLOWUPS_KEY = "@tomou:followups";

async function saveFollowups(key, ids) {
  try {
    const raw = await AsyncStorage.getItem(FOLLOWUPS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[key] = ids;
    await AsyncStorage.setItem(FOLLOWUPS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("saveFollowups", e);
  }
}

async function getFollowups(key) {
  try {
    const raw = await AsyncStorage.getItem(FOLLOWUPS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all[key] || [];
  } catch (e) {
    console.warn("getFollowups", e);
    return [];
  }
}

async function deleteFollowups(key) {
  try {
    const raw = await AsyncStorage.getItem(FOLLOWUPS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    delete all[key];
    await AsyncStorage.setItem(FOLLOWUPS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("deleteFollowups", e);
  }
}

async function cancelIds(ids = []) {
  try {
    for (const id of ids) {
      await notifee.cancelTriggerNotification(id);
    }
  } catch (e) {
    console.warn("cancelIds", e);
  }
}


notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    if (type === EventType.NOTIFICATION_TRIGGER) {
      const n = detail.notification;
      const data = n.data || {};

      if (data.kind === "initial") {
        const medId = data.medId;
        const medName = data.medName;
        const time = data.time;

        const dateStr = new Date(detail.trigger.timestamp).toISOString().slice(0,10);
        const key = `${medId}__${dateStr}__${time}`;

        // gera 5 follow-ups, a cada 10 minutos, começando +10min
        const followupIds = [];
        const now = Date.now();
        for (let i = 1; i <= 5; i++) {
          const fire = now + i * 10 * 60 * 1000; // +10*i minutos
          // criar a notificação de follow-up
          const notifId = `${key}__f${i}`;
          await notifee.createTriggerNotification(
            {
              id: notifId,
              title: `Lembrete — ${medName}`,
              body: `Ainda não marcou como tomado (${time}).`,
              data: { kind: "followup", medId, time, occ_key: key, attempt: String(i) },
              android: {
                channelId: "alarme",
                actions: [
                  { title: "Marcar como tomado", pressAction: { id: "take" } },
                  { title: "Me lembrar mais tarde", pressAction: { id: "snooze" } }, 

                ],
              },
            },
            {
              type: 1,
              timestamp: fire,
            }
          );
          followupIds.push(notifId);
        }
        // armazena followups pra poder cancelar depois
        await saveFollowups(key, followupIds);
      }

      // Se for followup e pressAction não foi acionado aqui, nada mais faz
      // (followups aparecem automaticamente)

    } else if (type === EventType.ACTION_PRESS) {
      // botão da notificação foi pressionado (pode rodar em background)
      const actionId = detail.pressAction.id; // ex: 'take'
      const notification = detail.notification;
      const data = notification.data || {};

      console.log("BG action pressed:", actionId, data);

      if (actionId === "take" && data.medId) {
        // usuário marcou como tomado direto na notificação
        const medId = data.medId;
        const time = data.time;
        const occKey = data.occ_key || (new Date().toISOString().slice(0,10) + "__" + time);

        // Cancelar followups relacionados
        const followups = await getFollowups(occKey);
        await cancelIds(followups);
        await deleteFollowups(occKey);

        // Registrar o evento no storage (histórico)
        // guardamos em "@tomou:events" com estrutura { date: [records] }
        const dateStr = new Date().toISOString().slice(0,10);
        const raw = await AsyncStorage.getItem("@tomou:events");
        const all = raw ? JSON.parse(raw) : {};
        const rec = {
          id: String(Date.now()) + Math.random().toString(36).slice(2,6),
          medId,
          medName: data.medName || "Remédio",
          time,
          takenAt: new Date().toISOString(),
        };
        all[dateStr] = all[dateStr] ? [...all[dateStr], rec] : [rec];
        await AsyncStorage.setItem("@tomou:events", JSON.stringify(all));

        // (Opcional) Cancelar a notificação corrente
        try { await notifee.cancelNotification(notification.id); } catch(e){}

        // pronto — action handled
      }

      if (actionId === "snooze" && data.medId) {
        const notificationId = notification.id;
        const medName = data.medName || "Remédio";

        try { await notifee.cancelNotification(notificationId); } catch(e){}

        // 2. Agendar uma nova notificação (snooze)
        const snoozeTime = Date.now() + 1 * 60 * 1000;

        await notifee.createTriggerNotification(
          {
            id: notificationId + "_snooze",
            title: `Soneca: ${medName}`,
            body: "Lembrete adiado por 30 minutos.",
            data: { ...data, kind: "snooze_followup" },
            android: {
              channelId: "alarme",
              actions: [
                { title: "Marcar como tomado", pressAction: { id: "take" } },
                { title: "Soneca (30 min)", pressAction: { id: "snooze" } }, 
              ],
            },
          },
          {
            type: TriggerType.TIMESTAMP,
            timestamp: snoozeTime,
          }
        );

        await notifee.displayNotification({
          title: "Alarme adiado",
          body: `O lembrete de ${medName} tocará novamente em 30 minutos.`,
          android: { channelId: "default", importance: AndroidImportance.LOW }
        });
      }
    }
  } catch (err) {
    console.warn("BG handler error", err);
  }
});

AppRegistry.registerComponent(appName, () => App);
