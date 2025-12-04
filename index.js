import { AppRegistry } from 'react-native';
import notifee, { EventType, TriggerType, AndroidImportance } from "@notifee/react-native";
import App from './App';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { name as appName } from './app.json';

const FOLLOWUPS_KEY = "@tomou:followups";
const MEDS_KEY = "@tomou:meds";

async function saveFollowups(key, ids) {
  try {
    const raw = await AsyncStorage.getItem(FOLLOWUPS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[key] = ids;
    await AsyncStorage.setItem(FOLLOWUPS_KEY, JSON.stringify(all));
  } catch (e) { console.warn(e); }
}

async function loadMeds() {
  try {
    const raw = await AsyncStorage.getItem(MEDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

async function getFollowups(key) {
  try {
    const raw = await AsyncStorage.getItem(FOLLOWUPS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all[key] || [];
  } catch (e) { return []; }
}

async function deleteFollowups(key) {
  try {
    const raw = await AsyncStorage.getItem(FOLLOWUPS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    delete all[key];
    await AsyncStorage.setItem(FOLLOWUPS_KEY, JSON.stringify(all));
  } catch (e) { console.warn(e); }
}

async function generateColoredIconUri(iconName, color) {
  const size = 128; 
  try {
      const iconSource = await Icon.getImageSource(iconName, size, color);
      return iconSource.uri;
  } catch (e) {
      console.error("Erro ao gerar URI do ícone:", e);
      return null; 
  }
}

notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    // 1. O ALARME TOCOU
    if (type === EventType.NOTIFICATION_TRIGGER) {
      const { notification } = detail;
      const data = notification.data || {};

      if (data.kind === "initial") {
        const allMeds = await loadMeds();
        const med = allMeds.find(m => m.id === data.medId);

        if (!med) {
            console.log("Medicamento não encontrado, pulando follow-ups.");
            return;
        }

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const key = `${data.medId}__${dateStr}__${data.time}`;

        console.log("ALARM TRIGGERED:", key);

        // Agenda 3 insistências (Follow-ups)
        const followupIds = [];
        const currentTime = Date.now();
        
        for (let i = 1; i <= 3; i++) {
          const fireDate = currentTime + (i * 10 * 60 * 1000); // +10, +20, +30 min
          const fId = `${key}__followup_${i}`;

          const iconUri = await generateColoredIconUri(med.icon, med.color); // 🚨 NOVO: Use 'med.icon' e 'med.color'

          await notifee.createTriggerNotification(
            {
              id: fId,
              title: `⚠️ Lembrete (${i}/3): ${med.name}`, // 🚨 NOVO: Use 'med.name'
              body: `Você ainda não marcou que tomou o remédio das ${data.time}.`,
              data: { 
                ...data, 
                kind: "followup", 
                occ_key: key, 
                icon: med.icon, // 🚨 NOVO: Adiciona icon e color nos dados para as próximas
                color: med.color, 
                medName: med.name // Adiciona medName
              }, 
              android: {
                channelId: "alarme",
                color: med.color || "#4f46e5", // 🚨 CORRIGIDO: Agora 'med' existe
                smallIcon: "ic_launcher_monochrome",
                largeIcon: iconUri,
                pressAction: { id: 'default' },
                actions: [
                    { title: "✅ Já tomei", pressAction: { id: "take" } },
                    { title: "💤 Soneca", pressAction: { id: "snooze" } }, 
                ],
              },
            },
            {
              type: TriggerType.TIMESTAMP,
              timestamp: fireDate,
            }
          );
          followupIds.push(fId);
        }
        await saveFollowups(key, followupIds);
      }
    } 
    // 2. BOTÃO PRESSIONADO
    else if (type === EventType.ACTION_PRESS) {
      const { pressAction, notification } = detail;
      const data = notification.data || {};
      
      console.log("BG ACTION:", pressAction.id);

      // MARCAR COMO TOMADO
      if (pressAction.id === "take" && data.medId) {
        const dateStr = new Date().toISOString().slice(0,10);
        const occKey = data.occ_key || `${data.medId}__${dateStr}__${data.time}`;

        // Cancela followups
        const fIds = await getFollowups(occKey);
        for(const id of fIds) await notifee.cancelTriggerNotification(id);
        await deleteFollowups(occKey);

        // Salva evento
        const raw = await AsyncStorage.getItem("@tomou:events");
        const all = raw ? JSON.parse(raw) : {};
        const rec = {
           id: String(Date.now()),
           medId: data.medId,
           medName: data.medName,
           time: data.time,
           takenAt: new Date().toISOString()
        };
        all[dateStr] = all[dateStr] ? [...all[dateStr], rec] : [rec];
        await AsyncStorage.setItem("@tomou:events", JSON.stringify(all));

        await notifee.cancelNotification(notification.id);
      }

      // SONECA
      if (pressAction.id === "snooze") {
        await notifee.cancelNotification(notification.id);

        const allMeds = await loadMeds();
        const med = allMeds.find(m => m.id === notification.id);

        const iconUri = await generateColoredIconUri(med.icon, med.color); // 🚨 NOVO: Use 'med.icon' e 'med.color'
        
        // Cria notificação daqui 10 min
        await notifee.createTriggerNotification({
            id: notification.id + "_snooze_bg",
            title: `Soneca: ${data.medName}`,
            body: "Adiando por 10 minutos...",
            data: { ...data },
            android: {
                channelId: "alarme",
                smallIcon: "ic_launcher_monochrome",
                largeIcon: iconUri,
                color: med.color || "#4f46e5",
                actions: [
                    { title: "✅ Já tomei", pressAction: { id: "take" } },
                    { title: "💤 +10 min", pressAction: { id: "snooze" } }, 
                ],
            }
        }, {
            type: TriggerType.TIMESTAMP,
            timestamp: Date.now() + 10 * 60 * 1000
        });
      }
    }
  } catch (err) {
    console.error("Background Error:", err);
  }
});

AppRegistry.registerComponent(appName, () => App);