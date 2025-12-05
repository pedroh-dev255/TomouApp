import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useColorScheme} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from 'react';

const SETTINGS = "@tomou:settings";

export default function ConfigsScreen({ navigation }) {
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

    const saveThemeSetting = (isDarkTheme) => {
        const newSettings = { ...settings, theme: isDarkTheme };
        setSettings(newSettings);
        AsyncStorage.setItem(SETTINGS, JSON.stringify(newSettings)).catch(err => {
            console.error("Erro ao salvar configurações:", err);
        });
    };

    return (
        <ScrollView  contentContainerStyle={isDark ? stylesDarkTheme.container : stylesLightTheme.container}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 30}}>
                <TouchableOpacity onPress={() => navigation.navigate('Home')}>
                    <Icon name="arrow-left" size={20} color={isDark ? '#ffffffff' : '#33333'} />
                </TouchableOpacity>
                <Text style={isDark ? stylesDarkTheme.title : stylesLightTheme.title}>Configurações</Text>
            </View>

            {/* Configuração de Tema */}
            {isDark ? (
                // Botão para MUDAR PARA MODO CLARO
                <TouchableOpacity onPress={() => saveThemeSetting(false)}>
                    <View style={isDark ? stylesDarkTheme.configItem : stylesLightTheme.configItem}>
                        <Icon name="weather-night" size={24} color="#ffffffff" />
                        <Text style={isDark ? stylesDarkTheme.configText : stylesLightTheme.configText}>Modo Escuro Ativado</Text>
                    </View>
                </TouchableOpacity>
            ) : (
                // Botão para MUDAR PARA MODO ESCURO
                <TouchableOpacity onPress={() => saveThemeSetting(true)}>
                    <View style={isDark ? stylesDarkTheme.configItem : stylesLightTheme.configItem}>
                        <Icon name="white-balance-sunny" size={24} color="#333333ff" />
                        <Text style={isDark ? stylesDarkTheme.configText : stylesLightTheme.configText}>Modo Claro Ativado</Text>
                    </View>
                </TouchableOpacity>
            )}
            
            <TouchableOpacity onPress={() => navigation.navigate('Debug')}>
                <View style={isDark ? stylesDarkTheme.configItem : stylesLightTheme.configItem}>
                    <Icon name="bug" size={24} color={isDark ? '#ff6161ff' : '#9b0101ff'} />
                    <Text style={isDark ? stylesDarkTheme.configText : stylesLightTheme.configText}>Debug Tool</Text>
                </View>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => navigation.navigate('Releases')}>
                <View style={isDark ? stylesDarkTheme.configItem : stylesLightTheme.configItem}>
                    <Icon name="update" size={24} color="#189100ff" />
                    <Text style={isDark ? stylesDarkTheme.configText : stylesLightTheme.configText}>Updates</Text>
                </View>
            </TouchableOpacity>
        </ScrollView> 
    );
}

const stylesDarkTheme = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: '#3a3a3aff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#ffffff',
    },
    configItem: {
        backgroundColor: '#272727ff',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        padding: 15,
        borderRadius: 8,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 3,
    },
    configText: {
        fontSize: 16,
        color: '#ffffff',
    },
});

const stylesLightTheme = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    configItem: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        padding: 15,
        borderRadius: 8,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    configText: {
        fontSize: 16,
        color: '#333',
    },
});