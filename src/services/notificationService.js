// src/services/notificationService.js
import notifee, { TriggerType, RepeatFrequency, AndroidImportance } from "@notifee/react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { loadMeds, getFollowups, saveFollowups, deleteFollowups } from "../utils/storage";

// Canais de notificação
export const CHANNELS = {
  ALARME: {
    id: "alarme",
    name: "Tomou?",
    sound: "alarme",
    importance: AndroidImportance.HIGH,
    vibration: true,
  }
};

// Tipos de notificação
export const NOTIFICATION_TYPES = {
  INITIAL: "initial",
  FOLLOWUP: "followup",
  TEST: "test"
};

export const NOTIFICATION_ACTIONS = {
    TAKE: "take",
    SNOOZE: "snooze"
};

// Inicializar canais
export async function initializeChannels() {
  try {
    await notifee.createChannel(CHANNELS.ALARME);
    console.log("Canais de notificação criados");
  } catch (e) {
    console.warn("Erro ao criar canais:", e);
  }
}

// Gerar URI do ícone colorido
export async function generateColoredIconUri(iconName, color, size = 128) {
  try {
    const iconSource = await Icon.getImageSource(iconName, size, color);
    return iconSource.uri;
  } catch (e) {
    console.error("Erro ao gerar URI do ícone:", e);
    return null;
  }
}

// Agendar notificação diária para um medicamento
export async function scheduleDailyForMed(med) {
  try {
    // Cancelar notificações existentes para este medicamento
    const pending = await notifee.getTriggerNotifications();
    for (const p of pending) {
      if (p.notification.data?.medId === med.id && p.notification.data?.kind === NOTIFICATION_TYPES.INITIAL) {
        await notifee.cancelTriggerNotification(p.notification.id);
      }
    }

    // Verificar se está dentro do prazo
    const now = new Date();
    const endDateObj = med.endDate ? new Date(med.endDate + 'T23:59:59') : null;
    if (endDateObj && endDateObj < now) {
      console.log(`Medicamento ${med.name} fora do prazo, não será reagendado.`);
      return;
    }

    // Agendar para cada horário
    for (const time of med.times) {
      const [hh, mm] = time.split(":").map(Number);
      let trigger = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);

      if (trigger.getTime() <= Date.now()) {
        trigger.setDate(trigger.getDate() + 1);
      }

      const iconUri = await generateColoredIconUri(med.icon, med.color);

      await notifee.createTriggerNotification({
        id: `${med.id}__${time.replace(':', '')}`,
        title: `Hora do Remédio: ${med.name}`,
        body: `Tomar às ${time}`,
        data: {
          kind: NOTIFICATION_TYPES.INITIAL,
          medId: med.id,
          medName: med.name,
          time: time
        },
        android: {
          channelId: CHANNELS.ALARME.id,
          color: med.color || "#4f46e5",
          smallIcon: "ic_launcher_monochrome",
          largeIcon: iconUri,
          actions: [
            { title: "✅ Já tomei", pressAction: { id: "take" } },
            { title: "💤 Soneca", pressAction: { id: "snooze" } },
          ],
        },
      }, {
        type: TriggerType.TIMESTAMP,
        timestamp: trigger.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
      });
    }
  } catch (error) {
    console.error("Erro ao agendar notificações:", error);
    throw error;
  }
}

// Agendar follow-ups (insistências)
export async function scheduleFollowups(med, initialData, initialTime) {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const key = `${med.id}__${dateStr}__${initialData.time}`;
    
    console.log("Agendando follow-ups para:", key);

    const followupIds = [];
    const currentTime = Date.now();

    for (let i = 1; i <= 3; i++) {
      const fireDate = currentTime + (i * 10 * 60 * 1000); // +10, +20, +30 min
      const followupId = `${key}__followup_${i}`;

      const iconUri = await generateColoredIconUri(med.icon, med.color);

      await notifee.createTriggerNotification({
        id: followupId,
        title: `⚠️ Lembrete (${i}/3): ${med.name}`,
        body: `Você ainda não marcou que tomou o remédio das ${initialData.time}.`,
        data: {
          ...initialData,
          kind: NOTIFICATION_TYPES.FOLLOWUP,
          occ_key: key,
          icon: med.icon,
          color: med.color,
          medName: med.name
        },
        android: {
          channelId: CHANNELS.ALARME.id,
          color: med.color || "#4f46e5",
          smallIcon: "ic_launcher_monochrome",
          largeIcon: iconUri,
          pressAction: { id: 'default' },

          actions: [
            { title: "✅ Já tomei", pressAction: { id: "take" } }          ],
        },
      }, {
        type: TriggerType.TIMESTAMP,
        timestamp: fireDate,
      });

      followupIds.push(followupId);
    }

    await saveFollowups(key, followupIds);
    return key;
  } catch (error) {
    console.error("Erro ao agendar follow-ups:", error);
    throw error;
  }
}

// Cancelar follow-ups
export async function cancelFollowups(Key) {
  try {
    const followupIds = await getFollowups(Key);
    for (const id of followupIds) {
      await notifee.cancelTriggerNotification(id);
    }
    await deleteFollowups(Key);
  } catch (error) {
    console.error("Erro ao cancelar follow-ups:", error);
  }
}

// Criar notificação de soneca
export async function createSnoozeNotification(notification, med, data) {
  try {
    await notifee.cancelNotification(notification.id);

    const iconUri = await generateColoredIconUri(med.icon, med.color);

    await notifee.createTriggerNotification({
      id: notification.id + "_snooze",
      title: `Soneca: ${data.medName}`,
      body: "Adiando por 10 minutos...",
      data: { ...data },
      android: {
        channelId: CHANNELS.ALARME.id,
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
  } catch (error) {
    console.error("Erro ao criar soneca:", error);
  }
}

// Testar notificação
export async function testNotification() {
  const id = 'test_id_' + Date.now();
  await notifee.createTriggerNotification({
    id: id,
    title: '🧪 Teste de Alarme',
    body: 'Se você viu isso, as notificações funcionam!',
    data: {
      kind: NOTIFICATION_TYPES.TEST,
      medName: 'Teste',
      time: new Date().toLocaleTimeString(),
      medId: 'test'
    },
    android: {
      channelId: CHANNELS.ALARME.id,
      color: '#4f46e5',
      largeIcon: 'https://cdn.iconscout.com/icon/premium/png-512-thumb/pill-test-6617307-5507519.png',
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
      smallIcon: 'ic_launcher_monochrome',
      actions: [
        { title: "Teste take", pressAction: { id: "take" } },
        { title: "Teste snooze", pressAction: { id: "snooze" } }
      ]
    }
  }, {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + 5000
  });
  
  return id;
}

// Cancelar todas as notificações de um medicamento
export async function cancelMedNotifications(medId) {
  try {
    const pending = await notifee.getTriggerNotifications();
    for (const p of pending) {
      if (p.notification.data?.medId === medId) {
        await notifee.cancelTriggerNotification(p.notification.id);
      }
    }
    return true;
  } catch (error) {
    console.error("Erro ao cancelar notificações do medicamento:", error);
    return false;
  }
}

// Obter notificações agendadas
export async function getScheduledNotifications() {
  try {
    const triggers = await notifee.getTriggerNotifications();
    triggers.sort((a, b) => (a.trigger.timestamp || 0) - (b.trigger.timestamp || 0));
    return triggers;
  } catch (error) {
    console.error("Erro ao obter notificações agendadas:", error);
    return [];
  }
}

export const requestNotificationPermission = async () => {
  try {
    const settings = await notifee.requestPermission({
      sound: true,
      announcement: true,
      alert: true,
      badge: true,
      carPlay: true,
      criticalAlert: true,
      provisional: false,
    });
    
    console.log("Permissão de notificação:", settings);
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch (e) {
    console.warn("Erro ao solicitar permissão:", e);
    return false;
  }
};

// Obter informações do sistema de notificações
export async function getNotificationSystemInfo() {
  try {
    const authStatus = await notifee.getNotificationSettings();
    const channels = await notifee.getChannels();
    const alarmeChannel = channels.find(c => c.id === CHANNELS.ALARME.id);

    return {
      permission: authStatus.authorizationStatus,
      alarmeChannel: alarmeChannel,
      channels: channels
    };
  } catch (error) {
    console.error("Erro ao obter informações do sistema:", error);
    return null;
  }
}