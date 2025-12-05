// src/screens/ReleasesScreen.js
import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Alert,
    Platform,
    useColorScheme,
    PermissionsAndroid
} from "react-native";
import DeviceInfo from "react-native-device-info";
import InstallApk from 'react-native-apk-install';
import RNFS from 'react-native-fs';
import { Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS = "@tomou:settings";

const BASE_RELEASE_URL = "https://tomou.phsolucoes.space/releases/";
const REPO_URL = `${BASE_RELEASE_URL}index.json`;

// Novos estados para a barra de progresso
const DownloadStates = {
    IDLE: 'IDLE',
    CONNECTING: 'CONNECTING',
    DOWNLOADING: 'DOWNLOADING',
    CHECKING_PERMISSION: 'CHECKING_PERMISSION',
    INSTALLING: 'INSTALLING',
    ERROR: 'ERROR',
};

export default function ReleasesScreen() {
    const [installedVersion, setInstalledVersion] = useState(null);
    const [releases, setReleases] = useState([]);
    const [latestRelease, setLatestRelease] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Novo estado de progresso detalhado
    const [downloadState, setDownloadState] = useState(DownloadStates.IDLE);
    const [downloadProgress, setDownloadProgress] = useState(0);

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

    // Função para comparar versões 1.2.10 > 1.2.9
    function compareVersions(v1, v2) {
        const a = v1.split(".").map(Number);
        const b = v2.split(".").map(Number);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const n1 = a[i] || 0;
            const n2 = b[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    }
    
    useEffect(() => {
        async function load() {
            setDownloadState(DownloadStates.CONNECTING);
            try {
                const version = DeviceInfo.getVersion();
                setInstalledVersion(version);

                const response = await fetch(REPO_URL);
                const data = await response.json();

                // 1. Ordena o array completo para o Histórico (Histórico)
                const sorted = data.releases.sort((a, b) => compareVersions(b.version, a.version));
                setReleases(sorted);
                
                // 2. 🎯 CORREÇÃO: Usa a string data.latest para encontrar o objeto de release.
                const latestVersionString = data.latest;
                
                // Procura o objeto de release que corresponde à string 'latest'
                const officialLatestRelease = data.releases.find(
                    release => release.version === latestVersionString
                );
                
                // 3. Define o objeto encontrado como o release mais recente
                if (officialLatestRelease) {
                    setLatestRelease(officialLatestRelease);
                } else {
                    // Caso a versão em 'latest' não exista no array 'releases'
                    console.warn(`A versão oficial (${latestVersionString}) não foi encontrada na lista de releases.`);
                    // Opcional: define o mais novo numericamente se o oficial falhar
                    setLatestRelease(sorted[0]); 
                }
                
                setDownloadState(DownloadStates.IDLE); 

            } catch (e) {
                console.log("Erro carregando releases:", e);
                setDownloadState(DownloadStates.ERROR);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    async function handleDownload(item) {
        if (downloadState !== DownloadStates.IDLE) return;
        
        setDownloadState(DownloadStates.DOWNLOADING);
        setDownloadProgress(0);

        try {
            const url = `${BASE_RELEASE_URL}${item.file}`; 
            
            const path = Platform.OS === 'android' 
                ? `${RNFS.DownloadDirectoryPath}/${item.file}` 
                : `${RNFS.CachesDirectoryPath}/${item.file}`;

            const download = RNFS.downloadFile({
                fromUrl: url,
                toFile: path,
                progress: (res) => {
                    const progress = Math.round((res.bytesWritten * 100) / res.contentLength);
                    setDownloadProgress(progress);
                },
            });

            const result = await download.promise;

            if (result.statusCode === 200) {
                setDownloadState(DownloadStates.INSTALLING);
                
                if (Platform.OS === 'android') {
                    await InstallApk.install(path);
                } else {
                    await Linking.openURL(`file://${path}`);
                }
                
                // O app continuará no estado 'INSTALLING' até que o usuário 
                // complete ou cancele a instalação manualmente.
                
            } else {
                setDownloadState(DownloadStates.ERROR);
                Alert.alert(`Erro no Download: Status ${result.statusCode}`);
            }
            
        } catch (error) {
            console.error("Erro no download ou instalação:", error);
            setDownloadState(DownloadStates.ERROR);
            Alert.alert("Erro", "Ocorreu um erro ao iniciar a instalação. O arquivo foi baixado, mas não foi possível abrir o instalador.");
        }
    }
    

    const isLatest = latestRelease 
    ? compareVersions(installedVersion, latestRelease.version) >= 0 
    : true;
    const isDownloading = downloadState !== DownloadStates.IDLE && downloadState !== DownloadStates.ERROR;
    
    const getProgressText = () => {
        switch (downloadState) {
            case DownloadStates.CONNECTING: return 'Conectando ao servidor...';
            case DownloadStates.DOWNLOADING: return `Baixando versão... ${downloadProgress}%`;
            case DownloadStates.CHECKING_PERMISSION: return 'Verificando permissões...';
            case DownloadStates.INSTALLING: return 'Download concluído. Iniciando instalação...';
            case DownloadStates.ERROR: return 'Erro. Tente novamente.';
            default: return 'Pronto para verificar atualizações.';
        }
    }; 
    
    const ProgressBar = () => (
        <View style={currentStyles.progressBarContainer}>
            <Text style={currentStyles.progressText}>{getProgressText()}</Text>
            {downloadState === DownloadStates.DOWNLOADING && (
                <View style={currentStyles.progressBarBackground}>
                    <View style={[currentStyles.progressBarFill, { width: `${downloadProgress}%` }]} />
                </View>
            )}
            {(downloadState === DownloadStates.CONNECTING || downloadState === DownloadStates.CHECKING_PERMISSION) && (
                 <ActivityIndicator color="#007AFF" style={{ marginTop: 8 }} />
            )}
        </View>
    );


    if (loading) {
        return (
            <View style={currentStyles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={{ marginTop: 10 }}>Carregando versões...</Text>
            </View>
        );
    }
    
    return (
        <View style={isDark ? {flex:1, backgroundColor:'#474747ff', paddingBottom: 30} : {flex:1, backgroundColor:'#ffffff', paddingBottom: 30}}>
            <View style={currentStyles.header}>
                <Text style={currentStyles.headerTitle}>Atualizações do Tomou? 📲</Text>
            </View>
            <ScrollView style={currentStyles.container}>
                {/* Caixa de Status da Versão Instalada */}
                <View style={currentStyles.installedBox}>
                    <View style={currentStyles.versionStatus}>
                        <Icon 
                            name={isLatest ? "check-circle" : "alert-circle"} 
                            size={24} 
                            color={isLatest ? "#10b981" : "#ef4444"} 
                            style={{ marginRight: 10 }}
                        />
                        <View>
                            <Text style={currentStyles.installedTitle}>Versão Instalada:</Text>
                            <Text style={currentStyles.installedVersion}>{installedVersion}</Text>
                        </View>
                    </View>
                    
                    {isLatest ? (
                        <Text style={currentStyles.isLatestMessage}>Parabéns! Você está usando a última versão disponível.</Text>
                    ) : (
                        <Text style={currentStyles.updateAvailableMessage}>Existe uma atualização importante disponível.</Text>
                    )}
                </View>

                {/* Barra de Progresso */}
                {(downloadState !== DownloadStates.IDLE || isDownloading || downloadState === DownloadStates.ERROR) && (
                    <ProgressBar />
                )}
                
                {/* Release mais recente em destaque (Apenas se não for a última versão) */}
                {latestRelease && !isLatest && (
                    <View style={currentStyles.featured}>
                        <Text style={currentStyles.featuredLabel}>Última Versão: {latestRelease.version}</Text>
                        <Text style={currentStyles.notes}>{latestRelease.notes}</Text>

                        {/* Botão de atualização SÓ aparece se houver atualização e não estiver baixando */}
                        {(!isLatest && !isDownloading) && (
                            <TouchableOpacity
                                style={currentStyles.btnUpdate}
                                onPress={() => handleDownload(latestRelease)}
                            >
                                <Icon name="download-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={currentStyles.btnUpdateText}>Baixar Atualização</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <Text style={currentStyles.subtitle}>Histórico Completo de Versões</Text>

                {/* Histórico de versões */}
                {releases.map((item, index) => (
                    <View key={index} style={currentStyles.item}>
                        <View style={{ flex: 1 }}>
                            <Text style={currentStyles.itemVersion}>{item.version}</Text>
                            <Text style={currentStyles.itemDate}>{item.launch_date}</Text>
                            <Text style={currentStyles.notes}>{item.notes}</Text>
                        </View>

                        {/* Botão Baixar sempre visível no histórico para versões mais novas */}
                        {installedVersion != item.version && (
                            <TouchableOpacity
                                style={[currentStyles.btnSmall, isDownloading && currentStyles.btnSmallDisabled]}
                                onPress={() => handleDownload(item)}
                                disabled={isDownloading}
                            >
                                <Text style={currentStyles.btnSmallText}>{isDownloading ? 'Baixando...' : 'Baixar'}</Text>
                            </TouchableOpacity>
                        )}
                        {/* Tag 'Instalado' para a versão atual ou anteriores */}
                        {installedVersion == item.version && (
                            <View style={currentStyles.downloadedTag}>
                                <Icon name="check" size={16} color="#10b981" />
                                <Text style={currentStyles.downloadedTagText}>Instalado</Text>
                            </View>
                        )}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: "#F7F7F7",
        
    },
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
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F7F7F7",
    },
    title: {
        fontSize: 24,
        fontWeight: "800",
        marginBottom: 20,
        color: "#1f2937",
    },
    
    // --- Estilos de Status de Versão
    installedBox: {
        padding: 18,
        backgroundColor: "#fff",
        borderRadius: 12,
        marginBottom: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    versionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    installedTitle: {
        fontSize: 16,
        fontWeight: "500",
        color: "#4b5563",
    },
    installedVersion: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#1f2937",
    },
    isLatestMessage: {
        marginTop: 5,
        color: "#10b981",
        fontWeight: "600",
    },
    updateAvailableMessage: {
        marginTop: 5,
        color: "#ef4444",
        fontWeight: "600",
    },
    
    // --- Estilos da Barra de Progresso
    progressBarContainer: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 25,
        borderLeftWidth: 4,
        borderLeftColor: "#007AFF",
    },
    progressText: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: "#1f2937",
    },
    progressBarBackground: {
        height: 10,
        backgroundColor: '#e5e7eb',
        borderRadius: 5,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#007AFF',
    },

    // --- Estilos de Release em Destaque
    featured: {
        backgroundColor: "#E9F4FF",
        padding: 18,
        borderRadius: 12,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: "#C8E1FF",
    },
    featuredLabel: {
        fontSize: 16,
        fontWeight: "700",
        color: "#007AFF",
    },
    notes: {
        fontSize: 14,
        marginTop: 8,
        color: "#4b5563",
    },
    btnUpdate: {
        flexDirection: 'row',
        backgroundColor: "#007AFF",
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: 'center',
        marginTop: 15,
    },
    btnUpdateText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
    },
    
    // --- Estilos do Histórico
    subtitle: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 10,
        color: "#1f2937",
    },
    item: {
        flexDirection: "row",
        backgroundColor: "#fff",
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    itemVersion: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1f2937",
    },
    itemDate: {
        fontSize: 12,
        color: "#6b7280",
        marginBottom: 4,
    },
    btnSmall: {
        backgroundColor: "#007AFF",
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignSelf: "center",
    },
    btnSmallDisabled: {
        backgroundColor: "#9ca3af",
    },
    btnSmallText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 14,
    },
    downloadedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d1fae5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    downloadedTagText: {
        color: '#065f46',
        fontWeight: '600',
        fontSize: 12,
        marginLeft: 4,
    }
});

const stylesDark = StyleSheet.create({
    ...styles, // Herda todos os estilos base, mas sobrescreve as cores
    container: {
        ...styles.container,
        backgroundColor: "#2e2e2eff", // Fundo Escuro
    },
    header: { 
        ...styles.header,
        backgroundColor: '#383838ff', 
        borderColor: '#333',
    },

    headerTitle: { ...styles.headerTitle, color: '#FFFFFF' },
    center: {
        ...styles.center,
        backgroundColor: "#313131ff",
    },
    title: {
        ...styles.title,
        color: "#FFFFFF", // Texto Branco
    },
    loadingText: {
        color: "#FFFFFF",
    },
    
    // --- Estilos de Status de Versão (Dark)
    installedBox: {
        ...styles.installedBox,
        backgroundColor: "#444444ff", // Fundo Escuro para a caixa
        shadowColor: "#313131ff",
        shadowOpacity: 0.5,
    },
    installedTitle: {
        ...styles.installedTitle,
        color: "#b0b0b0", // Texto Cinza Claro
    },
    installedVersion: {
        ...styles.installedVersion,
        color: "#FFFFFF", // Texto Branco
    },
    
    // --- Estilos da Barra de Progresso (Dark)
    progressBarContainer: {
        ...styles.progressBarContainer,
        backgroundColor: '#292929ff', // Fundo Escuro para a barra
        borderLeftColor: "#90C0FF", // Azul Mais Claro
    },
    progressText: {
        ...styles.progressText,
        color: "#FFFFFF", // Texto Branco
    },
    progressBarBackground: {
        ...styles.progressBarBackground,
        backgroundColor: '#333333',
    },
    progressBarFill: {
        ...styles.progressBarFill,
        backgroundColor: '#90C0FF', // Azul Mais Claro
    },

    // --- Estilos de Release em Destaque (Dark)
    featured: {
        ...styles.featured,
        backgroundColor: "#29293a", // Fundo Azul Escuro
        borderColor: "#4a4a6b",
    },
    featuredLabel: {
        ...styles.featuredLabel,
        color: "#90C0FF", // Azul Claro
    },
    notes: {
        ...styles.notes,
        color: "#CCCCCC", // Texto Claro
    },
    btnUpdate: {
        ...styles.btnUpdate,
        backgroundColor: "#90C0FF", // Botão Azul Claro
    },
    btnUpdateText: {
        ...styles.btnUpdateText,
        color: "#1e1e1e", // Texto Escuro no botão claro
    },
    
    // --- Estilos do Histórico (Dark)
    subtitle: {
        ...styles.subtitle,
        color: "#FFFFFF", // Texto Branco
    },
    item: {
        ...styles.item,
        backgroundColor: "#383838ff", // Fundo Escuro
        borderColor: '#333333',
    },
    itemVersion: {
        ...styles.itemVersion,
        color: "#FFFFFF", // Texto Branco
    },
    itemDate: {
        ...styles.itemDate,
        color: "#b0b0b0", // Texto Cinza Claro
    },
    btnSmall: {
        ...styles.btnSmall,
        backgroundColor: "#90C0FF",
    },
    btnSmallText: {
        ...styles.btnSmallText,
        color: "#1e1e1e",
    },
    downloadedTag: {
        ...styles.downloadedTag,
        backgroundColor: '#1a4732', // Fundo Verde Escuro
    },
    downloadedTagText: {
        ...styles.downloadedTagText,
        color: '#a7f3d0', // Texto Verde Claro
    }
});