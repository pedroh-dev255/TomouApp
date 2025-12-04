import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const MEDS_KEY = "@tomou:meds";
const FOLLOWUPS_KEY = "@tomou:followups";

export default function DebugScreen() {
    const [triggers, setTriggers] = useState([]);
    const [meds, setMeds] = useState([]);
    const [followups, setFollowups] = useState({});
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        setRefreshing(true);
        try {
            // 1. Busca agendamentos reais no sistema Android
            const notifications = await notifee.getTriggerNotifications();
            // Ordena por horário (do mais próximo para o mais distante)
            const sorted = notifications.sort((a, b) => (a.trigger.timestamp || 0) - (b.trigger.timestamp || 0));
            setTriggers(sorted);

            // 2. Busca dados salvos no banco
            const rawMeds = await AsyncStorage.getItem(MEDS_KEY);
            const rawFollowups = await AsyncStorage.getItem(FOLLOWUPS_KEY);

            setMeds(rawMeds ? JSON.parse(rawMeds) : []);
            setFollowups(rawFollowups ? JSON.parse(rawFollowups) : {});

        } catch (e) {
            console.error(e);
            Alert.alert("Erro", "Falha ao carregar dados de debug");
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCancelAll = async () => {
        Alert.alert(
            "Perigo",
            "Isso cancelará TODOS os agendamentos do sistema. Os remédios continuarão salvos, mas não tocarão.",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Zerar Agendamentos", 
                    style: 'destructive', 
                    onPress: async () => {
                        await notifee.cancelAllNotifications();
                        await AsyncStorage.removeItem(FOLLOWUPS_KEY); // Limpa chaves de followups perdidos
                        loadData();
                        Alert.alert("Limpo", "Todos os agendamentos foram removidos.");
                    }
                }
            ]
        );
    };

    const formatTime = (ts) => {
        if (!ts) return "---";
        const date = new Date(ts);
        return `${date.getDate()}/${date.getMonth() + 1} às ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Painel de Diagnóstico</Text>
                <TouchableOpacity onPress={loadData}>
                    <Icon name="refresh" size={24} color="#4f46e5" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
            >
                {/* --- SEÇÃO 1: LINHA DO TEMPO --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📅 Próximos Alarmes (Sistema)</Text>
                    <Text style={styles.subtitle}>O que o Android está programado para tocar:</Text>
                    
                    {triggers.length === 0 ? (
                        <Text style={styles.emptyText}>Nenhum alarme agendado no sistema.</Text>
                    ) : (
                        triggers.map((t, index) => {
                            const data = t.notification.data || {};
                            const isRepeat = t.trigger.repeatFrequency !== undefined;
                            
                            return (
                                <View key={t.notification.id} style={styles.rowItem}>
                                    <View style={styles.timeBadge}>
                                        <Text style={styles.timeText}>
                                            {new Date(t.trigger.timestamp).toLocaleTimeString().slice(0,5)}
                                        </Text>
                                        <Text style={styles.dateText}>
                                            {new Date(t.trigger.timestamp).getDate()}/{new Date(t.trigger.timestamp).getMonth()+1}
                                        </Text>
                                    </View>
                                    <View style={styles.infoCol}>
                                        <Text style={styles.infoTitle}>{t.notification.title}</Text>
                                        <Text style={styles.infoSub}>ID: {t.notification.id}</Text>
                                        <View style={styles.tagsRow}>
                                            <Text style={styles.tag}>{data.kind || 'desc'}</Text>
                                            {isRepeat && <Text style={[styles.tag, styles.tagRepeat]}>Repete Diário</Text>}
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* --- SEÇÃO 2: ESTADO DO BANCO DE DADOS --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💊 Banco de Dados (Remédios)</Text>
                    <Text style={styles.subtitle}>O que o app "sabe" que existe:</Text>
                    <Text style={styles.codeBlock}>{JSON.stringify(meds, null, 2)}</Text>
                </View>

                {/* --- SEÇÃO 3: FOLLOW-UPS PENDENTES --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔁 Follow-ups Ativos</Text>
                    <Text style={styles.subtitle}>IDs de notificações de insistência salvos para cancelamento:</Text>
                    <Text style={styles.codeBlock}>
                        {Object.keys(followups).length === 0 
                            ? "{}" 
                            : JSON.stringify(followups, null, 2)
                        }
                    </Text>
                </View>

                {/* --- AÇÕES DE DEBUG --- */}
                <View style={[styles.section, { borderBottomWidth: 0 }]}>
                    <Text style={styles.sectionTitle}>🔧 Reset</Text>
                    <TouchableOpacity style={styles.dangerButton} onPress={handleCancelAll}>
                        <Icon name="alert-octagon-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.dangerText}>CANCELAR TODOS AGENDAMENTOS</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 2,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    scrollContent: { padding: 16, paddingBottom: 40 },
    
    section: {
        marginBottom: 24,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
    subtitle: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
    emptyText: { fontStyle: 'italic', color: '#9ca3af', textAlign: 'center', marginVertical: 10 },
    
    // Lista de Trigger
    rowItem: {
        flexDirection: 'row',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        paddingBottom: 12,
    },
    timeBadge: {
        backgroundColor: '#eff6ff',
        padding: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        minWidth: 60,
    },
    timeText: { fontWeight: '800', color: '#2563eb', fontSize: 16 },
    dateText: { fontSize: 10, color: '#3b82f6' },
    
    infoCol: { flex: 1, justifyContent: 'center' },
    infoTitle: { fontWeight: '600', color: '#374151', fontSize: 14 },
    infoSub: { fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' },
    
    tagsRow: { flexDirection: 'row', marginTop: 4 },
    tag: { 
        fontSize: 10, backgroundColor: '#e5e7eb', 
        paddingHorizontal: 6, paddingVertical: 2, 
        borderRadius: 4, color: '#4b5563', marginRight: 6,
        textTransform: 'uppercase', fontWeight: 'bold'
    },
    tagRepeat: { backgroundColor: '#d1fae5', color: '#059669' },

    // JSON Blocks
    codeBlock: {
        backgroundColor: '#111827',
        color: '#10b981',
        padding: 12,
        borderRadius: 8,
        fontSize: 10,
        fontFamily: 'monospace',
    },

    // Botões
    dangerButton: {
        backgroundColor: '#ef4444',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 8,
        marginTop: 8,
    },
    dangerText: { color: '#fff', fontWeight: 'bold' },
    hint: { fontSize: 11, color: '#6b7280', marginTop: 8, textAlign: 'center' },
});