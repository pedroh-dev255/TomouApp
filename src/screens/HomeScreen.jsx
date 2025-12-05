import React, { useEffect, useState, useCallback } from "react";
import {
    View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, FlatList, Keyboard, Modal, ScrollView, Platform, useColorScheme
} from "react-native";
import notifee, {
    EventType, TriggerType, AuthorizationStatus, RepeatFrequency, AndroidImportance
} from '@notifee/react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import DateTimePicker from '@react-native-community/datetimepicker';


const MEDS_KEY = "@tomou:meds";
const EVENTS_KEY = "@tomou:events";
const FOLLOWUPS_KEY = "@tomou:followups";
const SETTINGS = "@tomou:settings";

const COLORS = ["#4f46e5", "#ef4444", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#6366f1"];
const ICONS = ["pill", "tablet", "bottle-tonic-plus", "needle", "medical-bag", "water"];


const getTodayStr = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
};

const formatTime = (date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
};

async function save(key, value) {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn(e); }
}
async function load(key) {
    try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function generateTimesFromInterval(interval, startInfo) {
    if (!interval || interval <= 0) return [];
    
    const [startH, startM] = startInfo.split(':').map(Number);
    
    const times = [];
    let currentH = startH;
    let currentM = startM;

    while (currentH < 24) {
        const hh = String(currentH).padStart(2, '0');
        const mm = String(currentM).padStart(2, '0');
        times.push(`${hh}:${mm}`);
        
        currentH += interval;
    }
    return times;
}

function shouldTakeMedOnDate(med, dateStr) {
    const targetDate = new Date(dateStr);
    const start = new Date(med.startDate);
    const end = med.endDate ? new Date(med.endDate + 'T23:59:59') : null;
    
    if (end && targetDate > end) return false;
    if (targetDate < start) return false;

    if (med.pauseDays > 0) {
        const diffTime = targetDate.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0) {
            const totalCycleDays = 1 + med.pauseDays; 
            const dayInCycle = diffDays % totalCycleDays;
            
            if (dayInCycle !== 0) {
                 return false;
            }
        }
    }

    return true; 
}



const PickerInput = ({ value, mode, placeholder, onChange, iconName, label, color }) => {
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    
    const currentDate = React.useMemo(() => {
        if (mode === 'date' && value) {
            return new Date(value + 'T12:00:00');
        }
        if (mode === 'time' && value) {
            const [h, m] = value.split(':').map(Number);
            const d = new Date();
            d.setHours(h, m, 0, 0);
            return d;
        }
        return new Date();
    }, [value, mode]);

    const showPicker = () => {
        setIsPickerVisible(true);
    };

    const handlePickerChange = (event, selectedDate) => {
        setIsPickerVisible(Platform.OS === 'ios');
        
        if (event.type === 'set' && selectedDate) {
            let newValue;
            if (mode === 'date') {
                newValue = selectedDate.toISOString().slice(0, 10);
            } else { 
                newValue = formatTime(selectedDate);
            }
            onChange(newValue);
        }
    };
    
    const displayValue = value ? (mode === 'date' ? value.split('-').reverse().join('/') : value) : placeholder;

    return (
        <View style={{flex: 1}}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TouchableOpacity onPress={showPicker} style={styles.pickerContainer}>
                <Icon name={iconName} size={20} color={color || '#6b7280'} style={{marginRight: 8}}/>
                <Text style={[styles.pickerText, !value && {color: '#9ca3af'}]}>
                    {displayValue}
                </Text>
            </TouchableOpacity>

            {isPickerVisible && (
                <DateTimePicker
                    testID="dateTimePicker"
                    value={currentDate}
                    mode={mode}
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handlePickerChange}
                />
            )}
        </View>
    );
};


export default function HomeScreen({ navigation }) {
    const [meds, setMeds] = useState([]);
    const [events, setEvents] = useState({});
    const [settings, setSettings] = useState({});
    const [dateOffset, setDateOffset] = useState(0);
    const selectedDate = getTodayStr(dateOffset);
    const [name, setName] = useState("");
    const [timesCsv, setTimesCsv] = useState("");
    const [intervalHours, setIntervalHours] = useState("");
    const [startTime, setStartTime] = useState("08:00");
    const [modalVisible, setModalVisible] = useState(false);
    const [startDate, setStartDate] = useState(getTodayStr());
    const [endDate, setEndDate] = useState("");
    const [pauseDays, setPauseDays] = useState("");
    const [iconModalVisible, setIconModalVisible] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState("pill");
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [manageModalVisible, setManageModalVisible] = useState(false);
    const [currentMed, setCurrentMed] = useState(null);
    const [pauseUntilDate, setPauseUntilDate] = useState("");
    const [pauseDaysCount, setPauseDaysCount] = useState("");
    const colorScheme = useColorScheme();

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


    const persistMeds = useCallback(async (next) => {
        setMeds(next);
        await save(MEDS_KEY, next);
    }, []);

    const persistEvents = useCallback(async (next) => {
        setEvents(next);
        await save(EVENTS_KEY, next);
    }, []);

    useEffect(() => {
        return notifee.onForegroundEvent(async ({ type, detail }) => {
            if (type === EventType.ACTION_PRESS && detail.pressAction) {
                const { pressAction, notification } = detail;
                const { data } = notification;

                if (pressAction.id === 'take' && data?.medId) {
                    const med = meds.find(m => m.id === data.medId);
                    if (med) await markTaken(med, data.time, getTodayStr());
                    await notifee.cancelNotification(notification.id);
                } 
                else if (pressAction.id === 'snooze') {
                    await notifee.cancelNotification(notification.id);
                    Alert.alert("Soneca", "Lembrete adiado por 10 minutos.");
                }
            }
        });
    }, [meds]);

    useEffect(() => {
        (async () => {
            const m = await load(MEDS_KEY) || [];
            const e = await load(EVENTS_KEY) || {};
            const s = await load(SETTINGS) || {};
            setMeds(m);
            setEvents(e);
            setSettings(s);
            await notifee.requestPermission();
        })();
    }, []);

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

    async function scheduleDailyForMed(med) {
        const pending = await notifee.getTriggerNotifications();
        for (const p of pending) {
            if (p.notification.data?.medId === med.id && p.notification.data?.kind === 'initial') {
                await notifee.cancelTriggerNotification(p.notification.id);
            }
        }
        
        const now = new Date();
        const endDateObj = med.endDate ? new Date(med.endDate + 'T23:59:59') : null;
        if (endDateObj && endDateObj < now) {
            console.log(`Medicamento ${med.name} fora do prazo, não será reagendado.`);
            return; 
        }

        for (const t of med.times) {
            const [hh, mm] = t.split(":").map(Number);
            let trigger = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);

            if (trigger.getTime() <= Date.now()) {
                trigger.setDate(trigger.getDate() + 1);
            }
            
            const iconUri = await generateColoredIconUri(med.icon, med.color);

            await notifee.createTriggerNotification({
                id: `${med.id}__${t.replace(':','')}`,
                title: `Hora do Remédio: ${med.name}`,
                body: `Tomar às ${t}`,
                data: { kind: "initial", medId: med.id, medName: med.name, time: t },
                android: {
                    channelId: "alarme",
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
    }

    function resetModalStates() {
        setName("");
        setTimesCsv("");
        setIntervalHours("");
        setStartTime("08:00");
        setStartDate(getTodayStr());
        setEndDate("");
        setPauseDays("");
        setSelectedIcon("pill");
        setSelectedColor(COLORS[0]);
    }

    async function addMed() {
        if (!name.trim()) return Alert.alert("Erro", "Digite o nome do medicamento.");
        
        let finalTimes = [];

        if (intervalHours.trim()) {
            const interval = parseInt(intervalHours);
            if (isNaN(interval) || interval <= 0) return Alert.alert("Erro", "Intervalo inválido.");
            if (!startTime.match(/^\d{2}:\d{2}$/)) return Alert.alert("Erro", "Hora de início inválida (HH:MM).");
            finalTimes = generateTimesFromInterval(interval, startTime);
        } else {
            if (!timesCsv.trim()) return Alert.alert("Erro", "Informe horários fixos ou o intervalo.");
            finalTimes = timesCsv.split(",").map(s => s.trim()).filter(t => t.match(/^\d{2}:\d{2}$/));
            if (finalTimes.length === 0) return Alert.alert("Erro", "Formato de horários inválido. Use HH:MM.");
        }
        
        if (!startDate) return Alert.alert("Erro", "A data de início é obrigatória.");
        
        const med = {
            id: String(Date.now()),
            name: name.trim(),
            times: finalTimes,
            intervalHours: intervalHours ? Number(intervalHours) : null,
            icon: selectedIcon,
            color: selectedColor,
            startDate: startDate, 
            endDate: endDate.trim() || null, 
            pauseDays: pauseDays ? Number(pauseDays) : 0, 
        };
        
        const next = [...meds, med];
        await persistMeds(next);
        await scheduleDailyForMed(med);

        // Reset
        resetModalStates();
        Keyboard.dismiss();
        setModalVisible(false);
        Alert.alert("Sucesso", "Medicamento agendado!");
    }

    async function markTaken(med, time, dateTarget) {
        const d = dateTarget || selectedDate;
        
        const shouldTake = shouldTakeMedOnDate(med, d);
        if (!shouldTake) {
             return Alert.alert("Atenção", `Hoje (${d.split('-').reverse().join('/')}) não é dia de tomar ${med.name} devido à pausa/ciclo.`, [{ text: "Ok" }]);
        }
        
        const rec = {
            id: String(Date.now()),
            medId: med.id,
            medName: med.name,
            time,
            takenAt: new Date().toISOString(),
        };

        const nextEvents = { ...events };
        nextEvents[d] = nextEvents[d] ? [...nextEvents[d], rec] : [rec];
        setEvents(nextEvents);
        await persistEvents(nextEvents);

        Alert.alert("Registrado", `${med.name} tomado às ${time} em ${d.split('-').reverse().join('/')}.`);
    }

    async function deleteMed(item) {
        Alert.alert("Excluir", `Remover ${item.name} permanentemente?`, [
            { text: "Cancelar" },
            { text: "Sim", style: 'destructive', onPress: async () => {
                const pending = await notifee.getTriggerNotifications();
                for(const p of pending) {
                    if(p.notification.data?.medId === item.id) {
                        await notifee.cancelTriggerNotification(p.notification.id);
                    }
                }
                const next = meds.filter(m => m.id !== item.id);
                await persistMeds(next);
                setManageModalVisible(false);
            }}
        ]);
    }

    async function pauseMedication() {
        if (!currentMed || !pauseUntilDate) return Alert.alert("Erro", "Selecione uma data de término de pausa.");

        const today = new Date(getTodayStr());
        const pauseEnd = new Date(pauseUntilDate);

        if (pauseEnd < today) {
            return Alert.alert("Erro", "A data de término da pausa deve ser hoje ou no futuro.");
        }
        
        const medToUpdate = currentMed;
        
        const nextMeds = meds.map(m => {
            if (m.id === medToUpdate.id) {
                const newEndDate = pauseUntilDate.trim() || null;
                return { ...m, endDate: newEndDate };
            }
            return m;
        });
        
        await persistMeds(nextMeds);
        
        const updatedMed = nextMeds.find(m => m.id === medToUpdate.id);
        if (updatedMed) {
            await scheduleDailyForMed(updatedMed);
        }

        setManageModalVisible(false);
        Alert.alert("Sucesso", `${medToUpdate.name} pausado até ${pauseUntilDate.split('-').reverse().join('/')}.`);
    }

    function openManageModal(med) {
        setCurrentMed(med);

        setPauseUntilDate(med.endDate || ""); 
        setManageModalVisible(true);
    }
    
    const eventsForDate = events[selectedDate] || [];
    const medsForDate = meds.filter(m => shouldTakeMedOnDate(m, selectedDate));


    const renderIconColorModal = () => (
        <Modal animationType="slide" transparent={true} visible={iconModalVisible} onRequestClose={() => setIconModalVisible(false)}>
            <View style={currentStyles.modalOverlay}>
                <View style={currentStyles.modalContent}>
                    <Text style={currentStyles.modalTitle}>Personalizar Aparência</Text>
                    
                    <Text style={currentStyles.label}>Escolha um Ícone:</Text>
                    <View style={currentStyles.iconGrid}>
                        {ICONS.map(ic => (
                            <TouchableOpacity 
                                key={ic} 
                                style={[currentStyles.iconSelectBtn, selectedIcon === ic && { borderColor: selectedColor, borderWidth: 2, backgroundColor: '#f0f9ff' }]}
                                onPress={() => setSelectedIcon(ic)}
                            >
                                <Icon name={ic} size={32} color={selectedIcon === ic ? selectedColor : "#9ca3af"} />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={currentStyles.label}>Escolha uma Cor:</Text>
                    <View style={currentStyles.colorGrid}>
                        {COLORS.map(c => (
                            <TouchableOpacity 
                                key={c} 
                                style={[currentStyles.colorCircle, { backgroundColor: c }, selectedColor === c && currentStyles.colorSelected]}
                                onPress={() => setSelectedColor(c)}
                            />
                        ))}
                    </View>
                    
                    <TouchableOpacity style={[currentStyles.btnAdd, {marginTop: 20, backgroundColor: selectedColor}]} onPress={() => setIconModalVisible(false)}>
                        <Text style={currentStyles.btnText}>Concluir</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
    
    const renderAddMedModal = () => (
        <Modal animationType="slide" transparent={false} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
            <ScrollView style={{flex:1, backgroundColor:'#f3f4f6'}} contentContainerStyle={currentStyles.containerPadding}>
                <View style={currentStyles.headerRow}>
                    <TouchableOpacity onPress={() => {setModalVisible(false); resetModalStates();}}>
                        <Icon name="close" size={28} color="#374151" />
                    </TouchableOpacity>
                    <Text style={currentStyles.headerTitle}>Cadastrar Novo Medicamento</Text>
                    <View style={{width: 28}}/>
                </View>
                
                <View style={currentStyles.card}>
                    <Text style={currentStyles.cardTitle}>Dados Principais</Text>
                    <View style={{flexDirection:'row', alignItems:'center', gap: 10, marginBottom: 10}}>
                        <TouchableOpacity 
                            style={[currentStyles.iconPreview, { backgroundColor: selectedColor + '20', borderColor: selectedColor }]} 
                            onPress={() => setIconModalVisible(true)}
                        >
                            <Icon name={selectedIcon} size={28} color={selectedColor} />
                            <View style={currentStyles.editBadge}><Icon name="pencil" size={10} color="#fff"/></View>
                        </TouchableOpacity>
                        <TextInput 
                            style={[currentStyles.input, {flex:1, marginBottom:0}]} 
                            placeholder="Nome (ex: Dipirona)" 
                            value={name} 
                            onChangeText={setName} 
                        />
                    </View>
                    
                    {/* Datas de Início e Fim (com DatePicker) */}
                    <View style={{flexDirection:'row', gap: 10, marginTop: 10}}>
                        <PickerInput 
                            label="Data de Início"
                            mode="date"
                            placeholder="AAAA-MM-DD"
                            value={startDate}
                            onChange={setStartDate}
                            iconName="calendar-start"
                            color={selectedColor}
                        />
                        <PickerInput 
                            label="Data de Fim (Opcional)"
                            mode="date"
                            placeholder="Indefinido"
                            value={endDate}
                            onChange={setEndDate}
                            iconName="calendar-end"
                            color={selectedColor}
                        />
                    </View>
                </View>
                
                {/* Horários */}
                <View style={currentStyles.card}>
                    <Text style={currentStyles.cardTitle}>Horários de Tomada</Text>
                    <View style={currentStyles.tabsContainer}>
                        <View style={{flexDirection:'row', gap: 10}}>
                            <View style={{flex: 1}}>
                                <Text style={currentStyles.label}>Horários Fixos (HH:MM, HH:MM...)</Text>
                                <TextInput 
                                    style={currentStyles.input} 
                                    placeholder="08:00, 20:00" 
                                    value={timesCsv} 
                                    onChangeText={(t) => { setTimesCsv(t); setIntervalHours(""); }} 
                                />
                            </View>
                            <View style={{width: 20, justifyContent:'center', alignItems:'center', paddingTop:15}}>
                                <Text style={{fontWeight:'bold', color:'#ccc'}}>OU</Text>
                            </View>
                            <View style={{flex: 1}}>
                                <Text style={currentStyles.label}>Intervalo (Horas)</Text>
                                <TextInput 
                                    style={currentStyles.input} 
                                    placeholder="Ex: 8" 
                                    keyboardType="numeric"
                                    value={intervalHours} 
                                    onChangeText={(t) => { setIntervalHours(t); setTimesCsv(""); }} 
                                />
                            </View>
                        </View>
                        {!!intervalHours && (
                            <View style={{marginTop: 5}}>
                                {/* Hora de Início (com TimePicker) */}
                                <PickerInput 
                                    label="Começando às:"
                                    mode="time"
                                    placeholder="HH:MM"
                                    value={startTime}
                                    onChange={setStartTime}
                                    iconName="clock-time-four-outline"
                                    color={selectedColor}
                                />
                                <Text style={{fontSize:11, color:'#666', marginTop:-5}}>
                                    Isso vai gerar horários a partir de {startTime} a cada {intervalHours}h.
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <TouchableOpacity style={[currentStyles.btnAdd, { backgroundColor: selectedColor, marginBottom: 50 }]} onPress={addMed}>
                    <Text style={currentStyles.btnText}>Salendar e Agendar</Text>
                </TouchableOpacity>
            </ScrollView>
        </Modal>
    );

    const renderManageMedModal = () => {
        if (!currentMed) return null;
        
        const isPaused = currentMed.endDate && new Date(currentMed.endDate) >= new Date(getTodayStr());

        const handleUnpause = async () => {
             const nextMeds = meds.map(m => (m.id === currentMed.id ? { ...m, endDate: null } : m));
             await persistMeds(nextMeds);
             await scheduleDailyForMed({ ...currentMed, endDate: null });
             setManageModalVisible(false);
             Alert.alert("Sucesso", `${currentMed.name} despausado. O agendamento foi retomado.`);
        };
        
        const handlePauseForDays = () => {
            const days = parseInt(pauseDaysCount);
            if (isNaN(days) || days <= 0) return Alert.alert("Erro", "Insira um número válido de dias.");
            
            const today = new Date();
            const pauseEnd = new Date(today);
            pauseEnd.setDate(today.getDate() + days);
            
            const newEndDate = pauseEnd.toISOString().slice(0, 10);
            setPauseUntilDate(newEndDate); 
            
            Alert.alert("Confirmar Pausa", `Pausar ${currentMed.name} por ${days} dias (até ${newEndDate.split('-').reverse().join('/')})?`, [
                { text: "Cancelar" },
                { text: "Pausar", onPress: () => { pauseMedicationWithDate(newEndDate); } }
            ]);
        };
        
        const pauseMedicationWithDate = async (newEndDate) => {
            const nextMeds = meds.map(m => (m.id === currentMed.id ? { ...m, endDate: newEndDate } : m));
            await persistMeds(nextMeds);
            await scheduleDailyForMed({ ...currentMed, endDate: newEndDate }); // Reagendar com novo fim
            setManageModalVisible(false);
            Alert.alert("Sucesso", `${currentMed.name} pausado até ${newEndDate.split('-').reverse().join('/')}.`);
        };


        return (
            <Modal animationType="slide" transparent={false} visible={manageModalVisible} onRequestClose={() => setManageModalVisible(false)}>
                <ScrollView style={{flex:1, backgroundColor:'#f3f4f6'}} contentContainerStyle={currentStyles.containerPadding}>
                    <View style={currentStyles.headerRow}>
                        <TouchableOpacity onPress={() => setManageModalVisible(false)}>
                            <Icon name="close" size={28} color="#374151" />
                        </TouchableOpacity>
                        <Text style={currentStyles.headerTitle}>Gerenciar: {currentMed.name}</Text>
                        <View style={{width: 28}}/>
                    </View>
                    
                    {/* Informações Atuais */}
                    <View style={currentStyles.card}>
                        <Text style={currentStyles.cardTitle}>Status e Detalhes</Text>
                        <View style={{flexDirection:'row', alignItems:'center', gap: 10, marginBottom: 10}}>
                             <View style={[currentStyles.miniIcon, { backgroundColor: currentMed.color + '20' }]}>
                                <Icon name={currentMed.icon} size={24} color={currentMed.color} />
                            </View>
                            <View>
                                <Text style={{fontWeight:'bold', fontSize: 16}}>{currentMed.name}</Text>
                                <Text style={currentStyles.medDetails}>Início: {currentMed.startDate.split('-').reverse().join('/')}</Text>
                                {currentMed.pauseDays > 0 && <Text style={currentStyles.medDetails}>Ciclo: 1 dia de uso / {currentMed.pauseDays} dias de pausa</Text>}
                                {currentMed.endDate && (
                                     <Text style={[currentStyles.medDetails, { color: isPaused ? '#ef4444' : '#6b7280', fontWeight: isPaused ? 'bold' : 'normal' }]}>
                                         {isPaused ? 'PAUSADO ATÉ: ' : 'TÉRMINO: '} {currentMed.endDate.split('-').reverse().join('/')}
                                     </Text>
                                )}
                            </View>
                        </View>
                        
                        {isPaused && (
                            <TouchableOpacity style={[currentStyles.btnAdd, {backgroundColor: '#10b981', marginTop: 15}]} onPress={handleUnpause}>
                                <Text style={currentStyles.btnText}>▶️ Retomar o Agendamento</Text>
                            </TouchableOpacity>
                        )}
                        
                    </View>
                    
                    {/* Seção de Pausa Manual */}
                    {!isPaused && (
                    <View style={currentStyles.card}>
                        <Text style={currentStyles.cardTitle}>Pausar o Tratamento (Manual)</Text>
                        
                        <Text style={currentStyles.label}>Pausar até uma Data Específica:</Text>
                        <View style={{flexDirection:'row', gap: 10, alignItems: 'center'}}>
                            <View style={{flex:1}}>
                                <PickerInput 
                                    mode="date"
                                    placeholder="Selecione a Data de Fim da Pausa"
                                    value={pauseUntilDate}
                                    onChange={setPauseUntilDate}
                                    iconName="calendar-alert"
                                    color="#f59e0b"
                                />
                            </View>
                            <TouchableOpacity 
                                style={[currentStyles.actionBtn, {backgroundColor: '#f59e0b'}]} 
                                onPress={() => pauseMedicationWithDate(pauseUntilDate)}
                                disabled={!pauseUntilDate}
                            >
                                <Icon name="pause" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={{height: 1, backgroundColor: '#eee', marginVertical: 15}}/>
                        
                        <Text style={currentStyles.label}>Pausar por um Número de Dias:</Text>
                        <View style={{flexDirection:'row', gap: 10, alignItems: 'center'}}>
                             <View style={{flex:1}}>
                                <TextInput 
                                    style={currentStyles.input} 
                                    placeholder="Ex: 5 dias" 
                                    keyboardType="numeric"
                                    value={pauseDaysCount} 
                                    onChangeText={setPauseDaysCount} 
                                />
                            </View>
                            <TouchableOpacity 
                                style={[currentStyles.actionBtn, {backgroundColor: '#f59e0b'}]} 
                                onPress={handlePauseForDays}
                                disabled={!pauseDaysCount}
                            >
                                <Icon name="pause" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={{fontSize:11, color:'#666', marginTop:5}}>
                            A pausa manual irá sobrescrever qualquer data de término agendada anteriormente.
                        </Text>
                    </View>
                    )}

                    {/* Botão de Deletar */}
                    <TouchableOpacity 
                        style={[currentStyles.btnAdd, { backgroundColor: '#ef4444', marginTop: 20, marginBottom: 50 }]} 
                        onPress={() => deleteMed(currentMed)}
                    >
                        <Icon name="trash-can-outline" size={20} color="#fff" style={{marginRight: 10}}/>
                        <Text style={currentStyles.btnText}>Excluir Medicamento</Text>
                    </TouchableOpacity>
                </ScrollView>
            </Modal>
        );
    };

    const renderHeader = () => (
        <View style={currentStyles.containerPadding}>
            {/* Header com Ícone de Adição */}
            <View style={currentStyles.headerRow}>
                <View style={{flexDirection:'row', gap:15}}>
                    <TouchableOpacity onPress={() => navigation.navigate('Configs')}>
                        <Icon name="cog" size={24} color="#747474ff" />
                    </TouchableOpacity>
                </View>

                <Text style={currentStyles.headerTitle}>Tomou? 💊</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={currentStyles.addIconBtn}>
                    <Icon name="plus" size={28} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Barra de Data */}
            <View style={currentStyles.dateNav}>
                <TouchableOpacity onPress={() => setDateOffset(d => (Number(d) || 0) - 1)}>
                    <Icon name="chevron-left" size={30} color="#4f46e5" />
                </TouchableOpacity>
                <View style={{alignItems:'center'}}>
                    <Text style={currentStyles.dateLabel}>
                        {dateOffset === 0 ? "HOJE" : dateOffset === -1 ? "ONTEM" : dateOffset === 1 ? "AMANHÃ" : selectedDate.split('-').reverse().slice(0,2).join('/')}
                    </Text>
                    <Text style={{fontSize:12, color:'#999'}}>{selectedDate.split('-').reverse().join('/')}</Text>
                </View>
                <TouchableOpacity onPress={() => setDateOffset(d => d + 1)}>
                    <Icon name="chevron-right" size={30} color="#4f46e5" />
                </TouchableOpacity>
            </View>

            {/* LISTA DO DIA */}
            <View style={currentStyles.card}>
                <Text style={currentStyles.cardTitle}>Doses de {dateOffset === 0 ? "Hoje" : selectedDate.split('-').reverse().join('/')}</Text>
                {medsForDate.length === 0 && <Text style={{color:'#999', fontStyle:'italic'}}>Nenhum remédio para tomar neste dia.</Text>}
                
                {meds.map(m => {
                    const isRelevant = !shouldTakeMedOnDate(m, selectedDate);
                    
                    if (m.endDate && new Date(selectedDate) > new Date(m.endDate + 'T23:59:59') && isRelevant) return null;

                    if (isRelevant && new Date(selectedDate) >= new Date(m.startDate) && m.pauseDays > 0) {
                         return (
                            <View key={m.id} style={[currentStyles.dailyMedItem, {backgroundColor: '#fef3c7', paddingHorizontal: 10, borderRadius: 8, marginBottom: 8}]}>
                                <Icon name="sleep" size={24} color="#d97706" style={{marginRight: 10}}/>
                                <View style={{flex:1}}>
                                    <Text style={currentStyles.medName}>{m.name}</Text>
                                    <Text style={[currentStyles.medDetails, {color: '#d97706', fontWeight: 'bold'}]}>DIA DE PAUSA POR CICLO ({m.pauseDays} dias)</Text>
                                </View>
                            </View>
                         );
                    }
                    
                    if (isRelevant && m.endDate && new Date(selectedDate) <= new Date(m.endDate + 'T23:59:59')) {
                         return (
                            <View key={m.id} style={[currentStyles.dailyMedItem, {backgroundColor: '#fee2e2', paddingHorizontal: 10, borderRadius: 8, marginBottom: 8}]}>
                                <Icon name="stop-circle-outline" size={24} color="#ef4444" style={{marginRight: 10}}/>
                                <View style={{flex:1}}>
                                    <Text style={currentStyles.medName}>{m.name}</Text>
                                    <Text style={[currentStyles.medDetails, {color: '#ef4444', fontWeight: 'bold'}]}>PAUSA MANUAL ATÉ {m.endDate.split('-').reverse().join('/')}</Text>
                                </View>
                            </View>
                         );
                    }

                    if (shouldTakeMedOnDate(m, selectedDate)) {
                        const isToday = selectedDate === getTodayStr();
                        return (
                            <View key={m.id} style={currentStyles.dailyMedItem}>
                                <View style={[currentStyles.miniIcon, { backgroundColor: (m.color || '#4f46e5') + '20' }]}>
                                    <Icon name={m.icon || 'pill'} size={24} color={m.color || '#4f46e5'} />
                                </View>

                                <View style={{flex:1, paddingHorizontal: 10}}>
                                    <Text style={currentStyles.medName}>{m.name}</Text>
                                    <Text style={currentStyles.medDetails}>
                                        {m.times.length} doses 
                                        {m.endDate && ` • Até ${m.endDate.split('-').reverse().join('/')}`}
                                        {m.pauseDays > 0 && ` • Ciclo Pausa: ${m.pauseDays}d`}
                                    </Text>
                                </View>

                                <View style={{flexDirection:'row', flexWrap:'wrap', justifyContent:'flex-end', maxWidth: 140, gap: 6}}>
                                    {m.times.map(t => {
                                        const taken = eventsForDate.some(e => e.medId === m.id && e.time === t);
                                        return (
                                            <TouchableOpacity 
                                                key={t} 
                                                style={[
                                                    currentStyles.chipBtn, 
                                                    { borderColor: m.color || '#4f46e5' },
                                                    taken && { backgroundColor: m.color || '#4f46e5', borderColor: m.color || '#4f46e5' }
                                                ]} 
                                                onPress={() => isToday && !taken && markTaken(m, t)}
                                                activeOpacity={taken ? 1 : (isToday ? 0.7 : 1)}
                                            >
                                                <Text style={[currentStyles.chipText, { color: taken ? '#fff' : (m.color || '#4f46e5') }]}>
                                                    {t}
                                                </Text>
                                                {taken && <Icon name="check" size={10} color="#fff" style={{marginLeft:2}}/>}
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>
                            </View>
                        );
                    }
                    return null;
                })}
            </View>
            
            <Text style={[currentStyles.cardTitle, {marginTop: 10}]}>Gerenciar Agendamentos</Text>
            {meds.length === 0 && <Text style={{color:'#999', fontStyle:'italic', paddingHorizontal: 16}}>Nenhum medicamento cadastrado.</Text>}
        </View>
    );

    const renderMedList = ({item}) => (
        <TouchableOpacity style={currentStyles.medListItemTouchable} onPress={() => openManageModal(item)}>
            <View style={{flexDirection:'row', alignItems:'center', flex: 1}}>
                <Icon name={item.icon || 'pill'} size={24} color={item.color || '#666'} style={{marginRight:10}}/>
                <View>
                    <Text style={{fontWeight:'600', fontSize: 16, color:'#1f2937'}}>{item.name}</Text>
                    <View style={{flexDirection:'row', flexWrap: 'wrap', marginTop: 4}}>
                         <Text style={currentStyles.medManagementDetails}>Doses: {item.times.length}</Text>
                         <Text style={currentStyles.medManagementDetails}>• Início: {item.startDate.split('-').reverse().join('/')}</Text>
                         {item.endDate && <Text style={[currentStyles.medManagementDetails, {color: new Date(item.endDate) >= new Date(getTodayStr()) ? '#ef4444' : '#9ca3af'}]}>
                             • Fim/Pausa: {item.endDate.split('-').reverse().join('/')}
                         </Text>}
                         {item.pauseDays > 0 && <Text style={currentStyles.medManagementDetails}>• Ciclo: {item.pauseDays}d</Text>}
                    </View>
                </View>
            </View>
            <Icon name="chevron-right" size={24} color="#9ca3af" />
        </TouchableOpacity>
    );


    return (
        <View style={{flex: 1, backgroundColor: '#f3f4f6'}}>
            {renderIconColorModal()}
            {renderAddMedModal()} 
            {renderManageMedModal()}
            
            <FlatList
                data={meds}
                keyExtractor={m => m.id}
                ListHeaderComponent={renderHeader()}
                renderItem={renderMedList}
                contentContainerStyle={{paddingBottom:50}}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    containerPadding: { padding: 16 },
    headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 15 },
    headerTitle: { fontSize: 22, fontWeight: '800', color:'#1f2937' },
    
    addIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', elevation: 5 },
    
    dateNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 15, elevation: 1 },
    dateLabel: { fontSize: 16, fontWeight: 'bold', color: '#4f46e5' },

    card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
    cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12, color:'#374151' },
    label: { fontSize: 12, fontWeight: '600', color:'#6b7280', marginBottom:4 },
    input: { backgroundColor: '#f9fafb', borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, marginBottom:10, color:'#1f2937', fontSize: 15 },
    
    pickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb', 
        borderWidth:1, 
        borderColor:'#e5e7eb', 
        borderRadius:10, 
        padding:10, 
        marginBottom:10,
        height: 48,
    },
    pickerText: {
        fontSize: 15, 
        color:'#1f2937',
        flex: 1,
    },
    iconPreview: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    editBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#333', borderRadius: 8, padding: 3 },
    btnAdd: { padding: 14, borderRadius: 12, alignItems:'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center' },
    btnText: { color: '#fff', fontWeight:'bold', fontSize: 16 },
    dailyMedItem: { flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderColor:'#f3f4f6' },
    miniIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    medName: { fontWeight:'700', fontSize:16, color:'#1f2937' },
    medDetails: { fontSize:13, color:'#6b7280' },
    chipBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    chipText: { fontSize: 12, fontWeight: '700' },
    medListItemTouchable: { 
        flexDirection:'row', 
        justifyContent:'space-between', 
        alignItems: 'center', 
        paddingVertical: 14, 
        paddingHorizontal: 16,
        backgroundColor:'#fff', 
        borderBottomWidth:1, 
        borderColor:'#f3f4f6' 
    },
    medManagementDetails: { fontSize:12, color:'#9ca3af', marginRight: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#333' },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 },
    iconSelectBtn: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
    colorCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, elevation: 2 },
    colorSelected: { borderWidth: 3, borderColor: '#333' },
    actionBtn: { padding: 10, borderRadius: 10, justifyContent: 'center', alignItems: 'center', height: 48, width: 48 },
});



const DARK_BG = '#121212';
const CARD_BG = '#1E1E1E';
const INPUT_BG = '#292929';
const BORDER_COLOR = '#333333';
const TEXT_COLOR_LIGHT = '#F0F0F0';
const TEXT_COLOR_MEDIUM = '#A0A0A0';
const TEXT_COLOR_DARK = '#D0D0D0';
const PRIMARY_COLOR_LIGHT = '#8A85FF';

const stylesDark = StyleSheet.create({
    ...styles, // Herda todas as propriedades para evitar repetição
    
    // Fundo da Tela
    containerPadding: { ...styles.containerPadding, backgroundColor: DARK_BG },

    // Títulos de Cabeçalho e Texto Principal
    headerTitle: { ...styles.headerTitle, color: TEXT_COLOR_LIGHT },
    
    // Navegação de Data
    dateNav: { 
        ...styles.dateNav, 
        backgroundColor: CARD_BG, 
        borderColor: BORDER_COLOR, 
        borderWidth: 1, 
        elevation: 0, // Desliga a sombra padrão do claro
        shadowOpacity: 0.2, // Mantém uma sombra mais sutil
        shadowColor: '#000'
    },
    dateLabel: { ...styles.dateLabel, color: PRIMARY_COLOR_LIGHT },

    // Cartões (Forms/Listas)
    card: { 
        ...styles.card, 
        backgroundColor: CARD_BG, 
        shadowColor: "#000", 
        shadowOpacity: 0.2, 
        elevation: 5,
    },
    cardTitle: { ...styles.cardTitle, color: TEXT_COLOR_DARK },
    
    // Labels e Textos Secundários
    label: { ...styles.label, color: TEXT_COLOR_MEDIUM },
    medDetails: { ...styles.medDetails, color: TEXT_COLOR_MEDIUM },
    medManagementDetails: { ...styles.medManagementDetails, color: '#6b7280' }, // Cinza claro já funciona bem
    
    // Campos de Input e Picker
    input: { 
        ...styles.input, 
        backgroundColor: INPUT_BG, 
        borderColor: BORDER_COLOR, 
        color: TEXT_COLOR_LIGHT 
    },
    pickerContainer: {
        ...styles.pickerContainer,
        backgroundColor: INPUT_BG, 
        borderColor: BORDER_COLOR, 
    },
    pickerText: {
        ...styles.pickerText,
        color: TEXT_COLOR_LIGHT,
    },
    
    // Itens de Lista
    dailyMedItem: { ...styles.dailyMedItem, borderColor: BORDER_COLOR },
    medName: { ...styles.medName, color: TEXT_COLOR_LIGHT },
    medListItemTouchable: { 
        ...styles.medListItemTouchable, 
        backgroundColor: CARD_BG, // Reutiliza o fundo do cartão para a lista
        borderColor: BORDER_COLOR 
    },
    
    // Modal
    modalOverlay: { ...styles.modalOverlay, backgroundColor: 'rgba(0,0,0,0.7)' },
    modalContent: { ...styles.modalContent, backgroundColor: CARD_BG },
    modalTitle: { ...styles.modalTitle, color: TEXT_COLOR_LIGHT },
    iconSelectBtn: { ...styles.iconSelectBtn, borderColor: BORDER_COLOR },
    colorCircle: { ...styles.colorCircle, borderColor: CARD_BG }, // Borda interna do círculo deve ser o fundo
    colorSelected: { ...styles.colorSelected, borderColor: TEXT_COLOR_LIGHT }, // Borda de seleção mais visível
});