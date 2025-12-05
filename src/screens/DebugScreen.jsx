import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, RefreshControl, useColorScheme} from 'react-native';
import notifee, { TriggerType, AndroidImportance, AuthorizationStatus, RepeatFrequency, AndroidChannel } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Chaves de AsyncStorage (Importante para saber o que buscar)
const MEDS_KEY = "@tomou:meds";
const EVENTS_KEY = "@tomou:events";
const FOLLOWUPS_KEY = "@tomou:followups"; 
const SETTINGS = "@tomou:settings";

const DebugMeta = ({ label, value, color = '#333' }) => (
    <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>{label}:</Text>
        <Text style={[styles.metaValue, { color }]}>{value}</Text>
    </View>
);

export default function DebugScreen() {
    const [scheduled, setScheduled] = useState([]);
    const [meds, setMeds] = useState([]);
    const [events, setEvents] = useState({});
    const [followups, setFollowups] = useState([]);
    const [systemInfo, setSystemInfo] = useState({});
    const [loading, setLoading] = useState(false);

    const colorScheme = useColorScheme();
    const [settings, setSettings] = useState({});

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const s = await AsyncStorage.getItem(SETTINGS);
                if (s) {
                    // Ao carregar, o valor 'theme' será um booleano (true para Dark, false para Light)
                    setSettings(JSON.parse(s));
                }
            } catch (error) {
                console.error("Erro ao carregar configurações:", error);
            }
        };

        loadSettings();
    }, []);


    const isDark = settings.theme ?? colorScheme === 'dark';

    const currentStyles = isDark ? stylesDark : styles;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const authStatus = await notifee.getNotificationSettings();
            const channels = await notifee.getChannels();
            
            const alarmeChannel = channels.find(c => c.id === 'alarme');

            setSystemInfo({
                permission: authStatus.authorizationStatus === AuthorizationStatus.AUTHORIZED ? '✅ Concedida' : '❌ Negada',
                alarmeChannel: alarmeChannel ? (alarmeChannel.importance > AndroidImportance.NONE ? '✅ Ativo' : '⚠️ Desativado') : '❌ Não existe',
                channelDetails: alarmeChannel,
            });

            const triggers = await notifee.getTriggerNotifications();
            triggers.sort((a,b) => (a.trigger.timestamp || 0) - (b.trigger.timestamp || 0));
            setScheduled(triggers);

            const rawMeds = await AsyncStorage.getItem(MEDS_KEY);
            const rawEvents = await AsyncStorage.getItem(EVENTS_KEY);
            const rawFollowups = await AsyncStorage.getItem(FOLLOWUPS_KEY);
            
            setMeds(rawMeds ? JSON.parse(rawMeds) : []);
            setEvents(rawEvents ? JSON.parse(rawEvents) : {});
            setFollowups(rawFollowups ? JSON.parse(rawFollowups) : []);

        } catch (e) {
            console.error("Erro ao carregar dados de debug:", e);
            Alert.alert("Erro", "Falha ao carregar dados de debug. Veja o console.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const testNotification = async () => {
        const id = 'test_id_' + Date.now();
        await notifee.createTriggerNotification({
            id: id,
            title: '🧪 Teste de Alarme',
            body: 'Se você viu isso, as notificações funcionam!',
            data: { kind: 'test', medName: 'Teste', time: new Date().toLocaleTimeString(), medId: 'test' },
            android: {
                channelId: 'alarme',
                color: '#4f46e5',
                largeIcon: 'https://cdn.iconscout.com/icon/premium/png-512-thumb/pill-test-6617307-5507519.png',
                importance: AndroidImportance.HIGH,
                pressAction: { id: 'default' },
                smallIcon: 'ic_launcher_monochrome',
                actions: [
                    { title: "Teste Ação", pressAction: { id: "take" } }
                ]
            }
        }, {
            type: TriggerType.TIMESTAMP,
            timestamp: Date.now() + 5000 // 5 seg
        });
        Alert.alert("Agendado", `Teste agendado em 5 segundos com ID: ${id}`);
        loadData();
    };

    const clearAll = async () => {
        Alert.alert(
            "⚠️ Reset Total", 
            "ATENÇÃO: Deseja realmente remover TODOS os agendamentos do sistema e TODOS os dados de medicamentos do aplicativo (AsyncStorage)? Esta ação é IRREVERSÍVEL.", 
            [
                { text: "Cancelar", style: 'cancel' },
                { 
                    text: "Sim, Resetar Tudo", 
                    style: 'destructive', 
                    onPress: async () => {
                        // Cancela todas as notificações agendadas no Notifee
                        await notifee.cancelAllNotifications();
                        
                        // Remove todas as chaves de dados do aplicativo
                        // FOLLOWUPS_KEY incluída na limpeza
                        await AsyncStorage.multiRemove([MEDS_KEY, EVENTS_KEY, FOLLOWUPS_KEY]); 
                        
                        // Recarrega os dados na tela de debug
                        loadData();
                        Alert.alert("Sucesso", "O aplicativo foi resetado! Todos os dados e agendamentos foram removidos.");
                    }
                }
            ]
        );
    };

    const getRepeatText = (freq) => {
        switch (freq) {
            case RepeatFrequency.DAILY: return 'Diário 🔁';
            case RepeatFrequency.HOURLY: return 'Por Hora ⏱️';
            case RepeatFrequency.WEEKLY: return 'Semanal 🗓️';
            default: return 'Único 📌';
        }
    };

    return (
        <View style={isDark ? {flex:1, backgroundColor:'#474747ff'} : {flex:1, backgroundColor:'#ffffff'}}>
            <View style={currentStyles.header}>
                <Text style={currentStyles.headerTitle}>🛠️ Painel de Debug (v1.2)</Text>
                <TouchableOpacity onPress={loadData}>
                    <Icon name="refresh" size={24} color="#4e7b96ff"/>
                </TouchableOpacity>
            </View>
            <ScrollView 
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
                contentContainerStyle={{paddingBottom: 20}}
            >
                
                {/* STATUS DO SISTEMA */}
                <View style={currentStyles.section}>
                    <Text style={currentStyles.secTitle}>Status do Sistema</Text>
                    <DebugMeta label="Permissão" value={systemInfo.permission} color={systemInfo.permission?.startsWith('✅') ? 'green' : 'red'} />
                    <DebugMeta 
                        label="Canal 'alarme'" 
                        value={systemInfo.alarmeChannel} 
                        color={systemInfo.alarmeChannel?.startsWith('✅') ? 'green' : (systemInfo.alarmeChannel?.startsWith('⚠️') ? '#f59e0b' : 'red')}
                    />
                    {systemInfo.channelDetails && (
                        <View style={currentStyles.detailContainer}>
                            <Text style={currentStyles.detailTitle}>Detalhes do Canal:</Text>
                            <Text style={currentStyles.detailText}>- ID: {systemInfo.channelDetails.id}</Text>
                            <Text style={currentStyles.detailText}>- Importância: {systemInfo.channelDetails.importance}</Text>
                            <Text style={currentStyles.detailText}>- Vibração: {systemInfo.channelDetails.vibration ? 'Sim' : 'Não'}</Text>
                        </View>
                    )}
                </View>
                
                {/* AÇÕES */}
                <View style={currentStyles.section}>
                    <Text style={currentStyles.secTitle}>Ferramentas de Teste</Text>
                    <View style={{flexDirection:'row', gap:10}}>
                        <TouchableOpacity style={[currentStyles.btn, {backgroundColor:'#4e7b96ff'}]} onPress={testNotification}>
                            <Text style={currentStyles.btnText}>🔔 Testar em 5s</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[currentStyles.btn, {backgroundColor:'#ef4444'}]} onPress={clearAll}>
                            <Text style={currentStyles.btnText}>🗑️ Limpar Tudo</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* NOTIFICAÇÕES NO SISTEMA */}
                <View style={currentStyles.section}>
                    <Text style={currentStyles.secTitle}>Agendado no Android ({scheduled.length})</Text>
                    {scheduled.length === 0 && <Text style={isDark ? {color:'#d6d6d6ff', fontStyle: 'italic'} : {color:'#3f3f3fff', fontStyle: 'italic'}}>Nada agendado (Notifee.getTriggerNotifications()).</Text>}
                    {scheduled.map((t, i) => (
                        <View key={t.notification.id || i} style={[currentStyles.item, {borderLeftColor: '#4e7b96ff'}]}>
                            <Text style={ isDark ? {fontWeight:'bold', color:'#ddddddff', fontSize: 14}: {fontWeight:'bold', color:'#313131ff', fontSize: 14}}>
                                {t.notification.title}
                            </Text>
                            <DebugMeta label="Execução" value={new Date(t.trigger.timestamp).toLocaleString()} color="#4e7b96ff" />
                            <DebugMeta label="Frequência" value={getRepeatText(t.trigger.repeatFrequency)} color={isDark ? '#d3d3d3ff' : '#757575ff'} />
                            <DebugMeta label="ID Notifee" value={t.notification.id} color='#757575ff'/>
                            {t.notification.data?.medId && (
                                <DebugMeta label="Dados (medId)" value={t.notification.data.medId} color="#10b981" />
                            )}
                            {t.notification.android?.largeIcon && (
                                <DebugMeta label="largeIcon" value="[URL/Base64 incluído]" color="#06b6d4" />
                            )}
                        </View>
                    ))}
                </View>

                {/* REMÉDIOS NO BANCO */}
                <View style={currentStyles.section}>
                    <Text style={currentStyles.secTitle}>Banco de Dados (AsyncStorage: {MEDS_KEY}) - {meds.length}</Text>
                    {meds.length === 0 && <Text style={ isDark ? {color:'#7c7c7cff', fontStyle: 'italic'} :{color:'#3a3a3aff', fontStyle: 'italic'}}>Nenhum medicamento encontrado no banco.</Text>}
                    {meds.map(m => (
                        <View key={m.id} style={[currentStyles.item, {borderLeftColor: m.color || '#333'}]}>
                            <Text style={{fontWeight:'bold', fontSize: 14, color: m.color || '#9b9b9bff'}}>{m.name}</Text>
                            <DebugMeta color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} label="Horários" value={m.times.join(", ")} />
                            <DebugMeta color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} label="Intervalo (h)" value={m.intervalHours || 'N/A'} />
                            <DebugMeta color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} label="Ícone" value={`${m.icon} (${m.color})`} />
                            <DebugMeta color={isDark ? '#d3d3d3ff' : '#3b3b3bff'} label="ID Local" value={m.id} />
                        </View>
                    ))}
                </View>
                
                {/* ACOMPANHAMENTOS (FOLLOW-UPS) - NOVO BLOCO */}
                <View style={currentStyles.section}>
                    <Text style={currentStyles.secTitle}>Acompanhamentos ({FOLLOWUPS_KEY}) - {followups.length}</Text>
                    {followups.length === 0 && <Text style={{color:'#888', fontStyle: 'italic'}}>Nenhum acompanhamento (follow-up) encontrado no banco.</Text>}
                    {followups.slice(0, 5).map(f => ( // Limitar a 5 para resumo
                        <View key={f.id} style={[currentStyles.item, {borderLeftColor: '#059669'}]}>
                            <Text style={{fontWeight:'bold', fontSize: 14, color: '#059669'}}>{f.title || f.name || 'Sem Título'}</Text>
                            <DebugMeta label="Tipo" value={f.type || 'Geral'} />
                            <DebugMeta label="Próx. Data" value={new Date(f.nextDue).toLocaleDateString() || 'N/A'} color="#059669" />
                            <DebugMeta label="ID Local" value={f.id} />
                        </View>
                    ))}
                    {followups.length > 5 && (
                        <Text style={{fontSize: 12, color: '#999', marginTop: 5}}>... e mais {followups.length - 5} acompanhamentos.</Text>
                    )}
                </View>
                {/* FIM: NOVO BLOCO */}

                {/* EVENTOS DE TOMADA */}
                <View style={currentStyles.section}>
                    <Text style={currentStyles.secTitle}>Eventos de Tomada ({EVENTS_KEY}) - {Object.keys(events).length} dias registrados</Text>
                    {Object.keys(events).length === 0 && <Text style={{color:'#888', fontStyle: 'italic'}}>Nenhum evento registrado (Tomadas).</Text>}
                    {Object.keys(events).reverse().slice(0, 3).map(date => (
                        <View key={date} style={[currentStyles.item, {borderLeftColor: '#4e7b96ff'}]}>
                            <Text style={{fontWeight:'bold', color:'#4e7b96ff'}}>{date}</Text>
                            {events[date].map((e, i) => (
                                <Text key={i} style={currentStyles.detailText}>- {e.medName} às {e.time} (Tomado: {new Date(e.takenAt).toLocaleTimeString()})</Text>
                            ))}
                        </View>
                    ))}
                    {Object.keys(events).length > 3 && (
                        <Text style={{fontSize: 12, color: '#999', marginTop: 5}}>... e mais {Object.keys(events).length - 3} dias.</Text>
                    )}
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
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
        borderLeftColor:'#4f46e530', // Padrão, mas sobrescrito onde necessário
        paddingLeft:10,
        backgroundColor: '#f9fafb',
        paddingVertical: 8,
        borderRadius: 4
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
    }
});

const stylesDark = StyleSheet.create({
    ...styles, // Herda a estrutura
    container: { backgroundColor: '#3a3a3aff' },
    header: { 
        ...styles.header,
        backgroundColor: '#383838ff', 
        borderColor: '#333',
    },
    headerTitle: { ...styles.headerTitle, color: '#FFFFFF' },
    section: { 
        ...styles.section,
        backgroundColor:'#323232', 
        shadowColor: "#000",
        shadowOpacity: 0.4,
        elevation: 5,
    },
    secTitle: { 
        ...styles.secTitle, 
        color:'#CCCCCC', 
        borderColor:'#333', 
    },
    item: { 
        ...styles.item, 
        color:'#FFFFFF',
        borderLeftColor:'#90C0FF', // Cor principal mais clara
        backgroundColor: '#292929',
    },
    itemTitle: { 
        ...styles.itemTitle, 
        color:'#575353ff', 
    },
    metaLabel: {
        ...styles.metaLabel,
        color: '#AAAAAA',
    },
    metaValue: {
        ...styles.metaValue,
        color: '#EEEEEE',
    },
    detailContainer: {
        ...styles.detailContainer,
        backgroundColor: '#333333',
    }, 
    detailTitle: {
        ...styles.detailTitle,
        color: '#CCCCCC',
    },
    detailText: {
        ...styles.detailText,
        color: '#BBBBBB',
    },
    emptyText: {
        color:'#AAAAAA', 
    },
    footerText: {
        fontSize: 12, 
        color: '#AAAAAA', 
        marginTop: 5
    }
});