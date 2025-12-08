// index.js
import { AppRegistry } from 'react-native';
import notifee, { EventType } from "@notifee/react-native";
import App from './App';
import { name as appName } from './app.json';

// Importar logger
import { initLogger, logError, logInfo, logWarn } from './src/services/loggerService';

// Importar serviços
import { 
  scheduleFollowups, 
  cancelFollowups, 
  createSnoozeNotification,
  NOTIFICATION_TYPES,
  NOTIFICATION_ACTIONS
} from './src/services/notificationService';
import { 
  loadMeds, 
  addEvent,
  saveFollowup,
  deleteFollowup
} from './src/utils/storage';

// Inicializar logger
initLogger().then(() => {
  logInfo('Background handler initialized');
});

// Event handler de background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    logInfo('Background event received', { type, detail });

    if(type === EventType.DELIVERED) {
      const { notification } = detail;
      const data = notification.data || {};

      logInfo('BG TRIGGER - kind:', data?.kind);
      if (data?.kind === NOTIFICATION_TYPES.INITIAL) {
        const allMeds = await loadMeds();
        const med = allMeds.find(m => m.id === data.medId);
        if (!med) {
          logWarn('Medicamento não encontrado, pulando follow-ups.');
          return;
        }
        logInfo('Agendando follow-ups no background para:', med.name);
        const result = await scheduleFollowups(med, data);
        if (result) {
          await saveFollowup(result.key, result.followupIds);
          logInfo('Follow-ups salvos no background:', { count: result.followupIds.length });
        }
      }
    }
    
    // 2. BOTÃO PRESSIONADO
    else if (type === EventType.ACTION_PRESS) {

      const { pressAction, notification } = detail;
      const data = notification.data || {};
      
      logInfo('BG ACTION:', pressAction.id);

      // MARCAR COMO TOMADO
      if (pressAction.id === NOTIFICATION_ACTIONS.TAKE && data.medId) {
        const dateStr = new Date().toISOString().slice(0, 10);
        const occKey = data.occ_key || `${data.medId}__${dateStr}__${data.time}`;

        logInfo('BG TAKE - cancelando follow-ups para:', occKey);
        
        // Cancelar follow-ups
        await cancelFollowups(data.medId);
        await deleteFollowup(data.medId);

        // Salvar evento
        const event = {
          id: String(Date.now()),
          medId: data.medId,
          medName: data.medName || data.medId,
          time: data.time,
          takenAt: new Date().toISOString()
        };
        
        await addEvent(dateStr, event);
        await notifee.cancelNotification(notification.id);
        
        logInfo('BG TAKE - evento salvo para:', data.medId);
      }

      // SONECA
      if (pressAction.id === NOTIFICATION_ACTIONS.SNOOZE) {
        const allMeds = await loadMeds();
        const med = allMeds.find(m => m.id === data.medId);
        
        if (med) {
          logInfo('BG SNOOZE - criando soneca para:', med.name);
          await createSnoozeNotification(notification, med, data);
          
          // Cancelar follow-ups se existir
          if (data.occ_key) {
            await cancelFollowups(data.medId);
            await deleteFollowup(data.medId);
          }
        } else {
          logWarn('BG SNOOZE - medicamento não encontrado:', data.medId);
        }
      }
    }
  } catch (err) {
    logError('Background Error:', err);
  }
});

AppRegistry.registerComponent(appName, () => App);