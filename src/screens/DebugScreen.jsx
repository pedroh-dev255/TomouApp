// src/screens/DebugScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, ScrollView, StyleSheet, TouchableOpacity, 
  Alert, RefreshControl, useColorScheme, TextInput, Modal,
  FlatList, ActivityIndicator, Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Serviços e utilitários
import { 
  getScheduledNotifications, 
  getNotificationSystemInfo, 
  testNotification,
  cancelMedNotifications,
  CHANNELS,
  NOTIFICATION_TYPES
} from "../services/notificationService";
import { 
  loadMeds, 
  loadEvents, 
  loadFollowups,
  loadSettings,
  clearAll
} from "../utils/storage";
import { STORAGE_KEYS } from "../utils/database";
import { formatDisplayDate } from "../utils/dateUtils";

// Serviço de logs
import {
  getLogs,
  clearLogs,
  getLogStats,
  filterLogsByLevel,
  searchLogs,
  LOG_LEVELS,
  logInfo,
  logWarn,
  logError,
  logDebug,
  saveLogsToStorage,
  loadLogsFromStorage
} from "../services/loggerService";

// Componente auxiliar
const DebugMeta = ({ label, value, color = '#333' }) => (
  <View style={styles.metaItem}>
    <Text style={styles.metaLabel}>{label}:</Text>
    <Text style={[styles.metaValue, { color }]} numberOfLines={1} ellipsizeMode="middle">
      {value}
    </Text>
  </View>
);

// Componente para exibir um log individual
const LogItem = ({ log, isDark }) => {
  const getLevelColor = (level) => {
    switch(level) {
      case LOG_LEVELS.ERROR: return '#ef4444';
      case LOG_LEVELS.WARN: return '#f59e0b';
      case LOG_LEVELS.INFO: return '#10b981';
      case LOG_LEVELS.DEBUG: return '#8b5cf6';
      default: return isDark ? '#d1d1d1' : '#666';
    }
  };
  
  const getLevelIcon = (level) => {
    switch(level) {
      case LOG_LEVELS.ERROR: return 'alert-circle';
      case LOG_LEVELS.WARN: return 'alert';
      case LOG_LEVELS.INFO: return 'information';
      case LOG_LEVELS.DEBUG: return 'bug';
      default: return 'message-text';
    }
  };
  
  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });
    } catch {
      return timestamp;
    }
  };
  
  return (
    <View style={[
      styles.logItem,
      { 
        backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
        borderLeftColor: getLevelColor(log.level),
        borderLeftWidth: 4
      }
    ]}>
      <View style={styles.logHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Icon 
            name={getLevelIcon(log.level)} 
            size={14} 
            color={getLevelColor(log.level)} 
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.logLevel, { color: getLevelColor(log.level) }]}>
            {log.level}
          </Text>
          <Text style={[styles.logTime, { color: isDark ? '#999' : '#666' }]}>
            {formatTime(log.timestamp)}
          </Text>
        </View>
        <Text style={[styles.logId, { color: isDark ? '#777' : '#999' }]}>
          #{log.id.substring(0, 8)}
        </Text>
      </View>
      
      <Text style={[styles.logMessage, { color: isDark ? '#e0e0e0' : '#333' }]}>
        {log.message}
      </Text>
      
      {log.data && (
        <View style={styles.logDataContainer}>
          <Text style={[styles.logDataLabel, { color: isDark ? '#999' : '#666' }]}>
            Dados:
          </Text>
          <Text style={[styles.logData, { color: isDark ? '#bbb' : '#555' }]} numberOfLines={3}>
            {log.data}
          </Text>
        </View>
      )}
    </View>
  );
};

// Modal de detalhes do log
const LogDetailModal = ({ visible, log, onClose, isDark }) => {
  if (!log) return null;
  
  const getLevelColor = (level) => {
    switch(level) {
      case LOG_LEVELS.ERROR: return '#ef4444';
      case LOG_LEVELS.WARN: return '#f59e0b';
      case LOG_LEVELS.INFO: return '#10b981';
      case LOG_LEVELS.DEBUG: return '#8b5cf6';
      default: return isDark ? '#d1d1d1' : '#666';
    }
  };
  
  const formatFullTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('pt-BR', { 
        dateStyle: 'medium',
        timeStyle: 'medium',
        fractionalSecondDigits: 3
      });
    } catch {
      return timestamp;
    }
  };
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? '#2a2a2a' : '#fff' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#333' }]}>
              Detalhes do Log
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={isDark ? '#999' : '#666'} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: isDark ? '#bbb' : '#666' }]}>ID:</Text>
              <Text style={[styles.detailValue, { color: isDark ? '#fff' : '#333' }]}>{log.id}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: isDark ? '#bbb' : '#666' }]}>Timestamp:</Text>
              <Text style={[styles.detailValue, { color: isDark ? '#fff' : '#333' }]}>{formatFullTime(log.timestamp)}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: isDark ? '#bbb' : '#666' }]}>Nível:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  backgroundColor: getLevelColor(log.level),
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>{log.level}</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: isDark ? '#bbb' : '#666' }]}>Mensagem:</Text>
              <Text style={[styles.detailValue, { 
                color: isDark ? '#fff' : '#333',
                backgroundColor: isDark ? '#333' : '#f5f5f5',
                padding: 10,
                borderRadius: 6,
                marginTop: 4
              }]}>{log.message}</Text>
            </View>
            
            {log.data && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: isDark ? '#bbb' : '#666' }]}>Dados:</Text>
                <ScrollView style={{
                  backgroundColor: isDark ? '#333' : '#f5f5f5',
                  borderRadius: 6,
                  marginTop: 4,
                  maxHeight: 200,
                  padding: 10
                }}>
                  <Text style={{ 
                    color: isDark ? '#fff' : '#333',
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
                  }}>
                    {JSON.stringify(JSON.parse(log.data), null, 2)}
                  </Text>
                </ScrollView>
              </View>
            )}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: isDark ? '#444' : '#e5e7eb' }]}
              onPress={onClose}
            >
              <Text style={{ color: isDark ? '#fff' : '#333' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const DebugScreen = () => {
  const [scheduled, setScheduled] = useState([]);
  const [meds, setMeds] = useState([]);
  const [events, setEvents] = useState({});
  const [followups, setFollowups] = useState({});
  const [systemInfo, setSystemInfo] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Estados para logs
  const [logs, setLogs] = useState([]);
  const [logStats, setLogStats] = useState({ total: 0, info: 0, warn: 0, error: 0, debug: 0 });
  const [selectedLog, setSelectedLog] = useState(null);
  const [logDetailVisible, setLogDetailVisible] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState('');
  const [isSavingLogs, setIsSavingLogs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const colorScheme = useColorScheme();
  const [settings, setSettings] = useState({});

  useEffect(() => {
    const loadAppSettings = async () => {
      try {
        const s = await loadSettings();
        setSettings(s);
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      }
    };

    loadAppSettings();
  }, []);

  const isDark = settings.theme ?? colorScheme === 'dark';

  const loadLogsData = useCallback(() => {
    const allLogs = getLogs();
    setLogs(allLogs);
    setLogStats(getLogStats());
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Carregar dados em paralelo
      const [
        sysInfo, 
        triggers, 
        rawMeds, 
        rawEvents, 
        rawFollowups
      ] = await Promise.all([
        getNotificationSystemInfo(),
        getScheduledNotifications(),
        loadMeds(),
        loadEvents(),
        loadFollowups()
      ]);

      setSystemInfo(sysInfo || {});
      setScheduled(triggers);
      setMeds(rawMeds);
      setEvents(rawEvents);
      setFollowups(rawFollowups);

      // Carregar logs
      loadLogsData();
      
      // Log da operação
      logInfo('Debug data loaded', {
        notifications: triggers.length,
        meds: rawMeds.length,
        events: Object.keys(rawEvents).length,
        followups: Object.keys(rawFollowups).length
      });

    } catch (e) {
      console.error("Erro ao carregar dados de debug:", e);
      logError('Erro ao carregar dados de debug', e);
      Alert.alert("Erro", "Falha ao carregar dados de debug. Veja o console.");
    } finally {
      setLoading(false);
    }
  }, [loadLogsData]);

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  const handleTestNotification = async () => {
    logInfo('Test notification requested');
    const id = await testNotification();
    if (id) {
      logInfo('Test notification scheduled', { id });
      Alert.alert("Agendado", `Teste agendado em 5 segundos com ID: ${id}`);
      loadData();
    } else {
      logError('Failed to schedule test notification');
      Alert.alert("Erro", "Falha ao agendar notificação de teste.");
    }
  };

  const handleClearAll = async () => {
    Alert.alert(
      "⚠️ Reset Total", 
      "ATENÇÃO: Deseja realmente remover TODOS os agendamentos do sistema e TODOS os dados de medicamentos do aplicativo (AsyncStorage)? Esta ação é IRREVERSÍVEL.", 
      [
        { text: "Cancelar", style: 'cancel' },
        { 
          text: "Sim, Resetar Tudo", 
          style: 'destructive', 
          onPress: async () => {
            logWarn('Full reset initiated');
            await clearAll();
            loadData();
            Alert.alert("Sucesso", "O aplicativo foi resetado! Todos os dados e agendamentos foram removidos.");
          }
        }
      ]
    );
  };

  const handleClearLogs = async () => {
    Alert.alert(
      "Limpar Logs",
      "Deseja limpar todos os logs?",
      [
        { text: "Cancelar", style: 'cancel' },
        {
          text: "Limpar",
          style: 'destructive',
          onPress: async () => {
            await clearLogs();
            loadLogsData();
            logInfo('Logs cleared manually');
          }
        }
      ]
    );
  };

  const handleSaveLogs = async () => {
    setIsSavingLogs(true);
    try {
      await saveLogsToStorage();
      logInfo('Logs saved to storage');
      Alert.alert("Sucesso", "Logs salvos no armazenamento permanente.");
    } catch (error) {
      logError('Failed to save logs', error);
      Alert.alert("Erro", "Falha ao salvar logs.");
    } finally {
      setIsSavingLogs(false);
    }
  };

  const handleLoadLogs = async () => {
    try {
      await loadLogsFromStorage();
      loadLogsData();
      logInfo('Logs loaded from storage');
    } catch (error) {
      logError('Failed to load logs', error);
    }
  };

  const handleAddTestLog = () => {
    const testData = {
      timestamp: new Date().toISOString(),
      randomValue: Math.random(),
      test: true
    };
    
    const levels = [LOG_LEVELS.INFO, LOG_LEVELS.WARN, LOG_LEVELS.ERROR, LOG_LEVELS.DEBUG];
    const randomLevel = levels[Math.floor(Math.random() * levels.length)];
    
    switch(randomLevel) {
      case LOG_LEVELS.INFO:
        logInfo('Log de teste informativo', testData);
        break;
      case LOG_LEVELS.WARN:
        logWarn('Log de teste de alerta', testData);
        break;
      case LOG_LEVELS.ERROR:
        logError('Log de teste de erro', testData);
        break;
      case LOG_LEVELS.DEBUG:
        logDebug('Log de teste de depuração', testData);
        break;
    }
    
    loadLogsData();
  };

  const getPermissionText = (status) => {
    switch (status) {
      case 1: return '✅ Autorizado';
      case 0: return '❌ Negado';
      case -1: return '❓ Não determinado';
      case 2: return '⚠️ Provisório';
      default: return '❓ Desconhecido';
    }
  };

  const getRepeatText = (freq) => {
    switch (freq) {
      case 0: return 'Diário 🔁';
      case 1: return 'Por Hora ⏱️';
      case 2: return 'Semanal 🗓️';
      default: return 'Único 📌';
    }
  };

  const getChannelStatus = (channel) => {
    if (!channel) return '❌ Não existe';
    return channel.importance > 0 ? '✅ Ativo' : '⚠️ Desativado';
  };

  const filteredLogs = React.useMemo(() => {
    let filtered = logs;
    
    // Filtrar por nível
    if (logLevelFilter) {
      filtered = filterLogsByLevel(logLevelFilter);
    }
    
    // Filtrar por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.level.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.data && log.data.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    return filtered;
  }, [logs, logLevelFilter, searchTerm]);

  const handleLogPress = (log) => {
    setSelectedLog(log);
    setLogDetailVisible(true);
  };

  const renderLogItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleLogPress(item)}>
      <LogItem log={item} isDark={isDark} />
    </TouchableOpacity>
  );

  const getLevelButtonStyle = (level) => {
    const isActive = logLevelFilter === level;
    return {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: isActive ? 
        (isDark ? '#444' : '#e5e7eb') : 
        'transparent',
      borderWidth: 1,
      borderColor: isDark ? '#555' : '#d1d5db',
    };
  };

  return (
    <View style={isDark ? {flex:1, backgroundColor:'#121212'} : {flex:1, backgroundColor:'#ffffff'}}>
      <View style={[styles.header, isDark && stylesDark.header]}>
        <Text style={[styles.headerTitle, isDark && stylesDark.headerTitle]}>🛠️ Painel de Debug</Text>
        <TouchableOpacity onPress={loadData}>
          <Icon name="refresh" size={24} color="#4e7b96ff"/>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
        contentContainerStyle={{paddingBottom: 20}}
      >
        
        {/* STATUS DO SISTEMA */}
        <View style={[styles.section, isDark && stylesDark.section]}>
          <Text style={[styles.secTitle, isDark && stylesDark.secTitle]}>Status do Sistema</Text>
          <DebugMeta 
            label="Permissão" 
            value={getPermissionText(systemInfo.permission)} 
            color={systemInfo.permission === 1 ? 'green' : 'red'} 
          />
          <DebugMeta 
            label="Canal 'alarme'" 
            value={getChannelStatus(systemInfo.alarmeChannel)} 
            color={getChannelStatus(systemInfo.alarmeChannel)?.startsWith('✅') ? 'green' : 'red'}
          />
          {systemInfo.alarmeChannel && (
            <View style={[styles.detailContainer, isDark && stylesDark.detailContainer]}>
              <Text style={[styles.detailTitle, isDark && stylesDark.detailTitle]}>Detalhes do Canal:</Text>
              <DebugMeta color={isDark ? '#d1d1d1ff': '#3f3f3fff'} label="ID" value={systemInfo.alarmeChannel.id} />
              <DebugMeta color={isDark ? '#d1d1d1ff': '#3f3f3fff'} label="Importância" value={systemInfo.alarmeChannel.importance} />
              <DebugMeta color={isDark ? '#d1d1d1ff': '#3f3f3fff'} label="Vibração" value={systemInfo.alarmeChannel.vibration ? 'Sim' : 'Não'} />
              <DebugMeta color={isDark ? '#d1d1d1ff': '#3f3f3fff'} label="Som" value={systemInfo.alarmeChannel.sound || 'Padrão'} />
            </View>
          )}
        </View>
        
        {/* AÇÕES */}
        <View style={[styles.section, isDark && stylesDark.section]}>
          <Text style={[styles.secTitle, isDark && stylesDark.secTitle]}>Ferramentas de Teste</Text>

          <View style={{ flexDirection:'row', gap:10, marginBottom: 10 }}>
            <TouchableOpacity 
              style={[styles.btn, {backgroundColor:'#4e7b96ff'}]} 
              onPress={handleTestNotification}
            >
              <Text style={styles.btnText}>🔔 Testar em 5s</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, {backgroundColor:'#ef4444'}]} 
              onPress={handleClearAll}
            >
              <Text style={styles.btnText}>🗑️ Limpar Tudo</Text>
            </TouchableOpacity>
          </View>
          
          <View style={{ flexDirection:'row', gap:10 }}>
            <TouchableOpacity 
              style={[styles.btn, {backgroundColor:'#f59e0b', flex: 1}]} 
              onPress={handleAddTestLog}
            >
              <Text style={styles.btnText}>📝 Add Test Log</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.btn, {backgroundColor:'#10b981', flex: 1}]} 
              onPress={handleSaveLogs}
              disabled={isSavingLogs}
            >
              {isSavingLogs ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnText}>💾 Salvar Logs</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        

        {/* NOTIFICAÇÕES NO SISTEMA */}
        <View style={[styles.section, isDark && stylesDark.section]}>
          <Text style={[styles.secTitle, isDark && stylesDark.secTitle]}>Agendado no Android ({scheduled.length})</Text>
          {scheduled.length === 0 && (
            <Text style={isDark ? stylesDark.emptyText : {color:'#3f3f3fff', fontStyle: 'italic'}}>
              Nada agendado (Notifee.getTriggerNotifications()).
            </Text>
          )}
          {scheduled.map((t, i) => (
            <View key={t.notification.id || i} style={[styles.item, isDark && stylesDark.item, {borderLeftColor: '#4e7b96ff'}]}>
              <Text style={ isDark ? stylesDark.itemTitle : {fontWeight:'bold', color:'#ffffffff', fontSize: 14}}>
                {t.notification.title}
              </Text>
              <DebugMeta 
                label="Execução" 
                value={new Date(t.trigger.timestamp).toLocaleString()} 
                color="#4e7b96ff" 
              />
              <DebugMeta 
                label="Frequência" 
                value={getRepeatText(t.trigger.repeatFrequency)} 
                color={isDark ? '#d3d3d3ff' : '#757575ff'} 
              />
              <DebugMeta 
                label="ID Notifee" 
                value={t.notification.id} 
                color={isDark ? '#d3d3d3ff' : '#757575ff'}
              />
              {t.notification.data?.medId && (
                <DebugMeta 
                  label="Dados (medId)" 
                  value={t.notification.data.medId} 
                  color="#10b981" 
                />
              )}
              {t.notification.data?.kind && (
                <DebugMeta 
                  label="Tipo" 
                  value={t.notification.data.kind} 
                  color="#06b6d4" 
                />
              )}
            </View>
          ))}
        </View>

        {/* REMÉDIOS NO BANCO */}
        <View style={[styles.section, isDark && stylesDark.section]}>
          <Text style={[styles.secTitle, isDark && stylesDark.secTitle]}>
            Banco de Dados (AsyncStorage: {STORAGE_KEYS.MEDS}) - {meds.length}
          </Text>
          {meds.length === 0 && (
            <Text style={isDark ? stylesDark.emptyText : {color:'#3a3a3aff', fontStyle: 'italic'}}>
              Nenhum medicamento encontrado no banco.
            </Text>
          )}
          {meds.map(m => (
            <View key={m.id} style={[styles.item, isDark && stylesDark.item, {borderLeftColor: m.color || '#333'}]}>
              <Text style={{
                fontWeight:'bold', 
                fontSize: 14, 
                color: m.color || (isDark ? '#9b9b9bff' : '#333')
              }}>
                {m.name}
              </Text>
              <DebugMeta 
                color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} 
                label="Horários" 
                value={m.times.join(", ")} 
              />
              <DebugMeta 
                color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} 
                label="Intervalo (h)" 
                value={m.intervalHours || 'N/A'} 
              />
              <DebugMeta 
                color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} 
                label="Ícone" 
                value={`${m.icon} (${m.color})`} 
              />
              <DebugMeta 
                color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} 
                label="ID Local" 
                value={m.id} 
              />
            </View>
          ))}
        </View>
        
        {/* ACOMPANHAMENTOS (FOLLOW-UPS) */}
        <View style={[styles.section, isDark && stylesDark.section]}>
          <Text style={[styles.secTitle, isDark && stylesDark.secTitle]}>
            Acompanhamentos ({STORAGE_KEYS.FOLLOWUPS}) - {Object.keys(followups).length}
          </Text>
          {Object.keys(followups).length === 0 && (
            <Text style={isDark ? stylesDark.emptyText : {color:'#888', fontStyle: 'italic'}}>
              Nenhum acompanhamento (follow-up) encontrado no banco.
            </Text>
          )}
          {Object.entries(followups).slice(0, 5).map(([key, ids]) => (
            <View key={key} style={[styles.item, isDark && stylesDark.item, {borderLeftColor: '#059669'}]}>
              <Text style={{fontWeight:'bold', fontSize: 14, color: '#059669'}}>
                {key}
              </Text>
              <DebugMeta color={isDark ? '#d3d3d3ff' : '#3b3b3bff'}  label="IDs" value={ids.join(", ")} />
              <DebugMeta color={isDark ? '#d3d3d3ff' : '#3b3b3bff'}  label="Quantidade" value={ids.length} />
            </View>
          ))}
          {Object.keys(followups).length > 5 && (
            <Text style={isDark ? stylesDark.footerText : {fontSize: 12, color: '#999', marginTop: 5}}>
              ... e mais {Object.keys(followups).length - 5} acompanhamentos.
            </Text>
          )}
        </View>

        {/* EVENTOS DE TOMADA */}
        <View style={[styles.section, isDark && stylesDark.section]}>
          <Text style={[styles.secTitle, isDark && stylesDark.secTitle]}>
            Eventos de Tomada ({STORAGE_KEYS.EVENTS}) - {Object.keys(events).length} dias registrados
          </Text>
          {Object.keys(events).length === 0 && (
            <Text style={isDark ? stylesDark.emptyText : {color:'#888', fontStyle: 'italic'}}>
              Nenhum evento registrado (Tomadas).
            </Text>
          )}
          {Object.keys(events).reverse().slice(0, 3).map(date => (
            <View key={date} style={[styles.item, isDark && stylesDark.item, {borderLeftColor: '#4e7b96ff'}]}>
              <Text style={{fontWeight:'bold', color:'#4e7b96ff'}}>
                {formatDisplayDate(date)}
              </Text>
              {events[date].map((e, i) => (
                <Text key={i} style={[styles.detailText, isDark && stylesDark.detailText]}>
                  - {e.medName} às {e.time} (Tomado: {new Date(e.takenAt).toLocaleTimeString()})
                </Text>
              ))}
            </View>
          ))}
          {Object.keys(events).length > 3 && (
            <Text style={isDark ? stylesDark.footerText : {fontSize: 12, color: '#999', marginTop: 5}}>
              ... e mais {Object.keys(events).length - 3} dias.
            </Text>
          )}
        </View>

        {/* INFORMAÇÕES DO ARMAZENAMENTO */}
        <View style={[styles.section, isDark && stylesDark.section]}>
          <Text style={[styles.secTitle, isDark && stylesDark.secTitle]}>Informações de Armazenamento</Text>
          <DebugMeta 
            color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} 
            label="Total Medicamentos" 
            value={meds.length} 
          />
          <DebugMeta 
            color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} 
            label="Total Dias com Eventos" 
            value={Object.keys(events).length} 
          />
          <DebugMeta 
            color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} 
            label="Total Acompanhamentos" 
            value={Object.keys(followups).length} 
          />
          <DebugMeta 
            color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} 
            label="Total Notificações Agendadas" 
            value={scheduled.length} 
          />
        </View>

        {/* LOGS DO SISTEMA */}
        <View style={[styles.section, isDark && stylesDark.section]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={[styles.secTitle, isDark && stylesDark.secTitle]}>Logs Internos ({logStats.total})</Text>
            <TouchableOpacity onPress={handleClearLogs}>
              <Icon name="trash-can-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
          
          {/* Estatísticas dos Logs */}
          <View style={[styles.logStatsContainer, isDark && stylesDark.logStatsContainer]}>
            <View style={styles.logStatItem}>
              <Text style={[styles.logStatLabel, { color: isDark ? '#bbb' : '#666' }]}>Total</Text>
              <Text style={[styles.logStatValue, { color: isDark ? '#fff' : '#333' }]}>{logStats.total}</Text>
            </View>
            <View style={styles.logStatItem}>
              <Text style={[styles.logStatLabel, { color: '#10b981' }]}>Info</Text>
              <Text style={[styles.logStatValue, { color: '#10b981' }]}>{logStats.info}</Text>
            </View>
            <View style={styles.logStatItem}>
              <Text style={[styles.logStatLabel, { color: '#f59e0b' }]}>Warn</Text>
              <Text style={[styles.logStatValue, { color: '#f59e0b' }]}>{logStats.warn}</Text>
            </View>
            <View style={styles.logStatItem}>
              <Text style={[styles.logStatLabel, { color: '#ef4444' }]}>Error</Text>
              <Text style={[styles.logStatValue, { color: '#ef4444' }]}>{logStats.error}</Text>
            </View>
            <View style={styles.logStatItem}>
              <Text style={[styles.logStatLabel, { color: '#8b5cf6' }]}>Debug</Text>
              <Text style={[styles.logStatValue, { color: '#8b5cf6' }]}>{logStats.debug}</Text>
            </View>
          </View>
          
          {/* Filtros */}
          <View style={{ marginBottom: 10 }}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                  color: isDark ? '#fff' : '#333',
                  borderColor: isDark ? '#444' : '#d1d5db'
                }
              ]}
              placeholder="Buscar logs..."
              placeholderTextColor={isDark ? '#777' : '#999'}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity 
                style={getLevelButtonStyle('')}
                onPress={() => setLogLevelFilter('')}
              >
                <Text style={{ color: isDark ? '#fff' : '#333', fontSize: 12 }}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={getLevelButtonStyle(LOG_LEVELS.INFO)}
                onPress={() => setLogLevelFilter(LOG_LEVELS.INFO)}
              >
                <Text style={{ color: '#10b981', fontSize: 12 }}>Info</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={getLevelButtonStyle(LOG_LEVELS.WARN)}
                onPress={() => setLogLevelFilter(LOG_LEVELS.WARN)}
              >
                <Text style={{ color: '#f59e0b', fontSize: 12 }}>Warn</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={getLevelButtonStyle(LOG_LEVELS.ERROR)}
                onPress={() => setLogLevelFilter(LOG_LEVELS.ERROR)}
              >
                <Text style={{ color: '#ef4444', fontSize: 12 }}>Error</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={getLevelButtonStyle(LOG_LEVELS.DEBUG)}
                onPress={() => setLogLevelFilter(LOG_LEVELS.DEBUG)}
              >
                <Text style={{ color: '#8b5cf6', fontSize: 12 }}>Debug</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[getLevelButtonStyle(''), { marginLeft: 'auto' }]}
                onPress={handleLoadLogs}
              >
                <Icon name="download" size={14} color={isDark ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Lista de Logs */}
          {filteredLogs.length === 0 ? (
            <View style={styles.noLogsContainer}>
              <Icon name="text-box-outline" size={40} color={isDark ? '#555' : '#ccc'} />
              <Text style={{ color: isDark ? '#777' : '#999', marginTop: 10 }}>
                Nenhum log encontrado
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredLogs.slice(0, 20)} // Mostrar apenas os 20 mais recentes
              renderItem={renderLogItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListFooterComponent={() => (
                filteredLogs.length > 20 && (
                  <View style={{ alignItems: 'center', padding: 10 }}>
                    <Text style={{ color: isDark ? '#777' : '#999', fontSize: 12 }}>
                      ... e mais {filteredLogs.length - 20} logs
                    </Text>
                  </View>
                )
              )}
            />
          )}
        </View>

      </ScrollView>
      
      {/* Modal de detalhes do log */}
      <LogDetailModal
        visible={logDetailVisible}
        log={selectedLog}
        onClose={() => setLogDetailVisible(false)}
        isDark={isDark}
      />
    </View>
  );
};

// ESTILOS COMPLETOS
const styles = StyleSheet.create({
  // Estilos gerais
  header: { 
    padding: 16, 
    backgroundColor: '#fff', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ddd'
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  section: { 
    backgroundColor:'#fff', 
    marginHorizontal:10, 
    marginTop: 10,
    padding:15, 
    borderRadius:10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  secTitle: { 
    fontSize:16, 
    fontWeight:'bold', 
    marginBottom:10, 
    color:'#374151', 
    borderBottomWidth:1, 
    borderColor:'#f3f4f6', 
    paddingBottom:5 
  },
  btn: { 
    padding:12, 
    borderRadius:8, 
    flex:1, 
    alignItems:'center' 
  },
  btnText: { color: '#fff', fontWeight:'bold' },
  item: { 
    marginBottom:15, 
    borderLeftWidth:4, 
    borderLeftColor:'#4e46e5c4',
    paddingLeft:10,
    backgroundColor: '#f9fafb',
    paddingVertical: 8,
    borderRadius: 4
  },
  itemTitle: {
    fontWeight:'bold',
    color:'#c2c2c2ff', 
    fontSize: 14
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metaLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailContainer: {
    marginTop: 5,
    padding: 5,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
  }, 
  detailTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 2,
  },
  detailText: {
    fontSize: 11,
    color: '#4b5563',
  },
  emptyText: {
    color:'#AAAAAA', 
    fontStyle: 'italic'
  },
  footerText: {
    fontSize: 12, 
    color: '#AAAAAA', 
    marginTop: 5
  },
  
  // Estilos para logs
  logItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  logTime: {
    fontSize: 11,
  },
  logId: {
    fontSize: 10,
  },
  logMessage: {
    fontSize: 13,
    marginBottom: 4,
  },
  logDataContainer: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  logDataLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  logData: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
  },
  logStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  logStatLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  logStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  noLogsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  
  // Estilos do modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
  },
});

// Estilos para tema escuro
const stylesDark = StyleSheet.create({
  header: { 
    backgroundColor: '#383838ff', 
    borderColor: '#333',
  },
  headerTitle: { color: '#FFFFFF' },
  section: { 
    backgroundColor:'#323232', 
    shadowColor: "#000",
    shadowOpacity: 0.4,
    elevation: 5,
  },
  secTitle: { 
    color:'#CCCCCC', 
    borderColor:'#333', 
  },
  item: { 
    borderLeftColor:'#90C0FF',
    backgroundColor: '#292929',
    color: '#DDDDDD',
  },
  itemTitle: {
    color:'#b4b4b4ff',
    fontWeight:'bold', 
    fontSize: 14
  },
  metaLabel: {
    color: '#AAAAAA',
  },
  metaValue: {
    color: '#EEEEEE',
  },
  detailContainer: {
    backgroundColor: '#333333',
  }, 
  detailTitle: {
    color: '#CCCCCC',
  },
  detailText: {
    color: '#BBBBBB',
  },
  emptyText: {
    color:'#AAAAAA', 
  },
  footerText: {
    color: '#AAAAAA',
  },
  
  // Logs no tema escuro
  logStatsContainer: {
    backgroundColor: '#2a2a2a',
  },
  logDataContainer: {
    borderTopColor: '#444',
  },
});

export default DebugScreen;