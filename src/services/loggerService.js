// src/services/loggerService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGS_KEY = "@tomou:logs";
const MAX_LOGS = 100; // Máximo de logs armazenados

export const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN', 
  ERROR: 'ERROR',
  DEBUG: 'DEBUG'
};

// Array em memória para logs
let logs = [];

// Sobrescrever console.log, console.error, etc.
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

// Função para adicionar log
export const addLog = async (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message),
    data: data ? JSON.stringify(data) : null
  };
  
  // Adicionar ao array em memória
  logs.unshift(logEntry); // Adiciona no início
  
  // Manter apenas os últimos MAX_LOGS
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(0, MAX_LOGS);
  }
  
  // Salvar no AsyncStorage periodicamente
  if (logs.length % 10 === 0) { // A cada 10 logs
    await saveLogsToStorage();
  }
  
  // Chamar console original
  const consoleMessage = `[${level}] ${message}`;
  switch(level) {
    case LOG_LEVELS.ERROR:
      originalConsoleError(consoleMessage, data || '');
      break;
    case LOG_LEVELS.WARN:
      originalConsoleWarn(consoleMessage, data || '');
      break;
    case LOG_LEVELS.INFO:
      originalConsoleInfo(consoleMessage, data || '');
      break;
    case LOG_LEVELS.DEBUG:
      originalConsoleDebug(consoleMessage, data || '');
      break;
    default:
      originalConsoleLog(consoleMessage, data || '');
  }
  
  return logEntry;
};

// Funções específicas por nível
export const logInfo = (message, data = null) => addLog(LOG_LEVELS.INFO, message, data);
export const logWarn = (message, data = null) => addLog(LOG_LEVELS.WARN, message, data);
export const logError = (message, data = null) => addLog(LOG_LEVELS.ERROR, message, data);
export const logDebug = (message, data = null) => addLog(LOG_LEVELS.DEBUG, message, data);

// Obter logs
export const getLogs = () => [...logs];

// Carregar logs do AsyncStorage
export const loadLogsFromStorage = async () => {
  try {
    const storedLogs = await AsyncStorage.getItem(LOGS_KEY);
    if (storedLogs) {
      logs = JSON.parse(storedLogs);
    }
    return logs;
  } catch (error) {
    logError('Erro ao carregar logs do storage', error);
    return [];
  }
};

// Salvar logs no AsyncStorage
export const saveLogsToStorage = async () => {
  try {
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    return true;
  } catch (error) {
    originalConsoleError('Erro ao salvar logs:', error);
    return false;
  }
};

// Limpar logs
export const clearLogs = async () => {
  logs = [];
  await AsyncStorage.removeItem(LOGS_KEY);
  return true;
};

// Inicializar interceptação do console
export const initConsoleInterception = () => {
  console.log = (...args) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    addLog(LOG_LEVELS.INFO, message);
    originalConsoleLog(...args);
  };
  
  console.error = (...args) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    addLog(LOG_LEVELS.ERROR, message);
    originalConsoleError(...args);
  };
  
  console.warn = (...args) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    addLog(LOG_LEVELS.WARN, message);
    originalConsoleWarn(...args);
  };
  
  console.info = (...args) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    addLog(LOG_LEVELS.INFO, message);
    originalConsoleInfo(...args);
  };
  
  console.debug = (...args) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    addLog(LOG_LEVELS.DEBUG, message);
    originalConsoleDebug(...args);
  };
  
  // Log inicial
  logInfo('Console interception initialized');
  return true;
};

// Restaurar console original (para testes)
export const restoreOriginalConsole = () => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
  console.debug = originalConsoleDebug;
};

// Obter contagem de logs por nível
export const getLogStats = () => {
  const stats = {
    total: logs.length,
    info: logs.filter(log => log.level === LOG_LEVELS.INFO).length,
    warn: logs.filter(log => log.level === LOG_LEVELS.WARN).length,
    error: logs.filter(log => log.level === LOG_LEVELS.ERROR).length,
    debug: logs.filter(log => log.level === LOG_LEVELS.DEBUG).length
  };
  return stats;
};

// Filtrar logs por nível
export const filterLogsByLevel = (level) => {
  if (!level) return logs;
  return logs.filter(log => log.level === level);
};

// Buscar logs por termo
export const searchLogs = (term) => {
  if (!term) return logs;
  const lowerTerm = term.toLowerCase();
  return logs.filter(log => 
    log.message.toLowerCase().includes(lowerTerm) ||
    log.level.toLowerCase().includes(lowerTerm)
  );
};

// Inicializar o logger
export const initLogger = async () => {
  await loadLogsFromStorage();
  initConsoleInterception();
  logInfo('Logger initialized');
  return true;
};