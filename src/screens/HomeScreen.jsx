// src/screens/HomeScreen.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    Alert,
    FlatList,
} from "react-native";
import notifee, {
    TriggerType,
    AuthorizationStatus,
    RepeatFrequency,
    AndroidImportance
} from '@notifee/react-native';

import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const MEDS_KEY = "@tomou:meds";
const EVENTS_KEY = "@tomou:events";
const FOLLOWUPS_KEY = "@tomou:followups";

const today = () => new Date().toISOString().slice(0, 10);

async function save(key, value) {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.warn("save error", e); }
}
async function load(key) {
    try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { console.warn("load error", e); return null; }
}

export default function HomeScreen({ navigation }) {
    const [meds, setMeds] = useState([]);
    const [events, setEvents] = useState({});
    const [selectedDate, setSelectedDate] = useState(today());
    const [name, setName] = useState("");
    const [timesCsv, setTimesCsv] = useState("08:00,20:00");
    const [intervalHours, setIntervalHours] = useState("");

    const persistMeds = useCallback(async (next) => {
        setMeds(next);
        await save(MEDS_KEY, next);
    }, []);

    const persistEvents = useCallback(async (next) => {
        setEvents(next);
        await save(EVENTS_KEY, next);
    }, []);

    useEffect(() => {
        (async () => {
            const m = await load(MEDS_KEY) || [];
            const e = await load(EVENTS_KEY) || {};
            setMeds(m);
            setEvents(e);
            
            const settings = await notifee.requestPermission();
            if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
                Alert.alert("Permita notificações para os alarmes funcionarem.");
            }

            if (notifee.Android) { 
                try {
                    const isInSnooze = await notifee.Android.isAppInSnoozeMode();
                    if (isInSnooze) {
                        Alert.alert("Seu aplicativo está em modo de suspensão, o que pode atrasar os alarmes.");
                    }
                    const alarmManager = notifee.Android.getAlarmManager();
                    if (alarmManager) {
                        const alarmStatus = await alarmManager.getAlarmManagerStatus();
                        if (alarmStatus?.canScheduleExactAlarms !== true) {
                            Alert.alert(
                                "Permissão de Alarme Exato Necessária",
                                "Por favor, permita que o app agende alarmes exatos...",
                                [
                                    { text: "Cancelar", style: "cancel" },
                                    {
                                        text: "Abrir Configurações",
                                        onPress: async () => {
                                            await alarmManager.openScheduleExactAlarmSettings();
                                        },
                                    },
                                ]
                            );
                        }
                    }
                } catch(e) {
                    console.warn("Notifee Android API check failed:", e);
                }
            }
        })();
    }, []);

    const eventsForDate = events[selectedDate] || [];

    async function scheduleDailyForMed(med) {
        for (const t of med.times) {
            const [hh, mm] = t.split(":").map(Number);
            const now = new Date();

            let trigger = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                hh,
                mm,
                0,
                0
            );

            if (trigger.getTime() <= Date.now()) {
                trigger.setDate(trigger.getDate() + 1);
            }

            await notifee.createTriggerNotification(
                {
                    id: `${med.id}__${t}`,
                    title: `Tomar: ${med.name}`,
                    body: `Hora: ${t}`,
                    data: { kind: "initial", medId: med.id, medName: med.name, time: t },
                    android: {
                        channelId: "alarme",
                        actions: [
                            {
                                title: "Marcar como tomado",
                                pressAction: { id: "take" },
                            },
                            {
                                title: "Me lembrar mais tarde",
                                pressAction: { id: "snooze" }
                            }, 
                        ],
                    },
                },
                {
                    type: TriggerType.TIMESTAMP,
                    timestamp: trigger.getTime(),
                    repeatFrequency: RepeatFrequency.DAILY,
                }
            );
        }
    }

    async function addMed() {
        if (!name.trim()) return Alert.alert("Digite o nome do remédio");
        const times = timesCsv.split(",").map(s => s.trim()).filter(Boolean);
        if (times.length === 0 && !intervalHours.trim()) return Alert.alert("Informe horários ou intervalo");
        
        const med = {
            id: String(Date.now()),
            name: name.trim(),
            times,
            intervalHours: intervalHours ? Number(intervalHours) : null,
        };
        
        const next = [...meds, med];
        await persistMeds(next);
        await scheduleDailyForMed(med);

        setName("");
        setTimesCsv("08:00,20:00");
        setIntervalHours("");
        Alert.alert("Remédio adicionado");
    }

    async function markTaken(med, time) {
        const dateStr = selectedDate;
        const rec = {
            id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
            medId: med.id,
            medName: med.name,
            time,
            takenAt: new Date().toISOString(),
        };

        const nextEvents = { ...(events || {}) };
        nextEvents[dateStr] = nextEvents[dateStr] ? [...nextEvents[dateStr], rec] : [rec];
        await persistEvents(nextEvents);

        const occKey = `${med.id}__${dateStr}__${time}`;
        const raw = await load(FOLLOWUPS_KEY) || {};
        const followIds = raw[occKey] || [];
        
        if (followIds.length > 0) {
            for (const id of followIds) {
                try { await notifee.cancelTriggerNotification(id); } catch (e) { }
            }
            delete raw[occKey];
            await save(FOLLOWUPS_KEY, raw);
        }

        Alert.alert("Marcado como tomado");
    }

    const renderHeader = useCallback(() => (
        <View style={styles.containerPadding}>
            <Text style={styles.title}>Tomou? 💊 — Hoje: {selectedDate}</Text>

            <TouchableOpacity 
                style={styles.updateButton}
                onPress={() => navigation.navigate('Releases')}
            >

                <Text style={{ color: '#4f46e5', fontWeight: '600' }}>
                  <Icon name="update" size={20} color={styles.primaryText.color} /> 
                  Verificar Atualizações</Text>
            </TouchableOpacity>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Icon name="plus-circle-outline" size={20} color={styles.primaryText.color} />
                    <Text style={styles.cardTitle}>Novo Remédio</Text>
                </View>

                <TextInput 
                    style={styles.input} 
                    placeholder="Nome do Remédio" 
                    value={name} 
                    onChangeText={setName} 
                    placeholderTextColor="#9ca3af"
                />

                <View style={styles.inputGroup}>
                    <TextInput 
                        style={[styles.input, styles.inputHalf]} 
                        placeholder="Horários (08:00,14:00)" 
                        value={timesCsv} 
                        onChangeText={setTimesCsv} 
                        placeholderTextColor="#9ca3af"
                    />
                    <TextInput 
                        style={[styles.input, styles.inputHalf]} 
                        placeholder="Intervalo (h), ex: 4" 
                        value={intervalHours} 
                        onChangeText={setIntervalHours} 
                        keyboardType="numeric"
                        placeholderTextColor="#9ca3af"
                    />
                </View>
                
                <View style={styles.buttonGroup}>
                    <TouchableOpacity style={styles.btnAdd} onPress={addMed}>
                        <Icon name="check-circle-outline" size={18} color="#fff" style={{ marginRight: 5 }} />
                        <Text style={styles.btnText}>Adicionar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnClear} onPress={() => { setName(""); setTimesCsv("08:00,20:00"); setIntervalHours(""); }}>
                        <Icon name="close-circle-outline" size={18} color="#fff" style={{ marginRight: 5 }} />
                        <Text style={styles.btnText}>Limpar</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Icon name="calendar-check" size={20} color={styles.primaryText.color} />
                    <Text style={styles.cardTitle}>Doses de Hoje</Text>
                </View>
                
                {meds.length === 0 ? <Text style={styles.secondaryText}>Nenhum remédio agendado. Adicione um!</Text> : meds.map(m => (
                    <View key={m.id} style={styles.dailyMedItem}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.medName}>{m.name}</Text>
                            <Text style={styles.medDetails}>{m.times.length ? m.times.join(" • ") : (m.intervalHours ? `A cada ${m.intervalHours}h` : "")}</Text>
                        </View>
                        <View style={styles.timesGroup}>
                            {(m.times.length ? m.times : ["--"]).map(t => (
                                <TouchableOpacity key={t} style={styles.takeBtn} onPress={() => markTaken(m, t)}>
                                    <Text style={styles.takeBtnText}>{t}</Text>
                                    <Icon name="pill" size={14} color="#fff" style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Icon name="history" size={20} color={styles.primaryText.color} />
                    <Text style={styles.cardTitle}>Registro de Doses — {selectedDate}</Text>
                </View>
                
                {eventsForDate.length === 0 ? <Text style={styles.secondaryText}>Nenhum registro de dose hoje.</Text> : eventsForDate.map(r => (
                    <View key={r.id} style={styles.historyItem}>
                        <Icon name="check-circle" size={20} color="#10b981" style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.medName}>{r.medName}</Text>
                            <Text style={styles.medDetails}>Tomado às {new Date(r.takenAt).toLocaleTimeString().slice(0, 5)} (Agendado: {r.time})</Text>
                        </View>
                    </View>
                ))}
            </View>
            
            <Text style={styles.medsListTitle}>Todos os Agendamentos</Text>
        </View>
    ), [selectedDate, meds, name, timesCsv, intervalHours, events, eventsForDate, addMed, markTaken]);

    return (
        <FlatList
            data={meds}
            keyExtractor={m => m.id}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.content}
            renderItem={({ item }) => (
                <View style={styles.medListItem}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.medName}>{item.name}</Text>
                        <Text style={styles.medDetails}>{item.times.length ? `Horários: ${item.times.join(" • ")}` : (item.intervalHours ? `Intervalo: A cada ${item.intervalHours}h` : "")}</Text>
                    </View>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => {
                        Alert.alert("Remédio", `Remover ${item.name}?`, [
                            { text: "Cancelar", style: "cancel" },
                            { text: "Remover", style: "destructive", onPress: async () => {
                                const next = meds.filter(m => m.id !== item.id);
                                await persistMeds(next);
                                for (const t of item.times) {
                                    const id = `${item.id}__${t}`;
                                    try { await notifee.cancelTriggerNotification(id); } catch (e) { }
                                }
                                Alert.alert("Removido", `O remédio ${item.name} foi removido.`);
                            }}
                        ]);
                    }}>
                        <Icon name="trash-can-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    primary: { color: "#4f46e5" },
    danger: { color: "#ef4444" },
    success: { color: "#10b981" },
    primaryText: { color: "#1f2937" },
    secondaryText: { color: "#6b7280" },

    content: { paddingBottom: 120, backgroundColor: "#f3f4f6" },
    containerPadding: { padding: 16 },
    title: { 
        fontSize: 24, 
        fontWeight: "800", 
        marginBottom: 16, 
        color: "#1f2937" 
    },

    card: { 
        backgroundColor: "#fff", 
        borderRadius: 16, 
        padding: 16, 
        marginBottom: 16, 
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
        paddingBottom: 8,
    },
    cardTitle: { 
        fontSize: 18, 
        fontWeight: "700", 
        color: "#1f2937",
        marginLeft: 8
    },

    input: { 
        backgroundColor: "#f9fafb", 
        padding: 12, 
        borderRadius: 10, 
        marginBottom: 10, 
        borderWidth: 1, 
        borderColor: "#e5e7eb",
        color: "#1f2937",
        fontSize: 16,
    },
    inputGroup: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    inputHalf: {
        width: '49%',
        marginBottom: 0,
    },

    buttonGroup: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 12,
    },
    btnAdd: { 
        flex: 1, 
        backgroundColor: "#10b981",
        padding: 12, 
        borderRadius: 10, 
        alignItems: "center", 
        justifyContent: "center", 
        marginRight: 8,
        flexDirection: 'row',
    },
    btnClear: { 
        flex: 1, 
        backgroundColor: "#6b7280",
        padding: 12, 
        borderRadius: 10, 
        alignItems: "center", 
        justifyContent: "center",
        flexDirection: 'row',
    },
    btnText: { 
        color: "#fff", 
        fontWeight: "700", 
        fontSize: 16
    },

    dailyMedItem: { 
        flexDirection: "row", 
        justifyContent: "space-between", 
        alignItems: "center", 
        paddingVertical: 10, 
        borderBottomWidth: 1, 
        borderBottomColor: "#f3f4f6" 
    },
    timesGroup: { 
        flexDirection: "row", 
        flexWrap: 'wrap', 
        justifyContent: 'flex-end',
        maxWidth: '50%',
    },
    takeBtn: { 
        backgroundColor: "#4f46e5", 
        paddingHorizontal: 10, 
        paddingVertical: 6, 
        borderRadius: 8, 
        marginLeft: 8, 
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
    },
    takeBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
    
    historyItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6"
    },

    medsListTitle: { 
        fontSize: 16, 
        fontWeight: "700", 
        marginBottom: 8, 
        paddingHorizontal: 16, 
        color: "#1f2937" 
    },
    medListItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    deleteBtn: { 
        backgroundColor: "#ef4444", 
        padding: 10, 
        borderRadius: 8, 
        alignItems: "center", 
        justifyContent: "center",
    },
    
    medName: { fontWeight: "600", fontSize: 16, color: "#1f2937" },
    medDetails: { color: "#6b7280", fontSize: 13 },
});