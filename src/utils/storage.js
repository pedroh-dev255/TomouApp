// src/utils/storage.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./database";

// Funções genéricas
export async function save(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Erro ao salvar em", key, e);
  }
}

export async function load(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("Erro ao carregar de", key, e);
    return null;
  }
}

export async function remove(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn("Erro ao remover", key, e);
  }
}

export async function clearAll() {
  try {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  } catch (e) {
    console.warn("Erro ao limpar storage", e);
  }
}

// Funções específicas para medicamentos
export async function loadMeds() {
  const meds = await load(STORAGE_KEYS.MEDS);
  return meds || [];
}

export async function saveMeds(meds) {
  await save(STORAGE_KEYS.MEDS, meds);
}

// Funções específicas para eventos
export async function loadEvents() {
  const events = await load(STORAGE_KEYS.EVENTS);
  return events || {};
}

export async function saveEvents(events) {
  await save(STORAGE_KEYS.EVENTS, events);
}

export async function addEvent(date, event) {
  const events = await loadEvents();
  events[date] = events[date] ? [...events[date], event] : [event];
  await saveEvents(events);
  return events;
}

// Funções específicas para follow-ups
export async function getFollowups(key) {
  try {
    const all = await load(STORAGE_KEYS.FOLLOWUPS) || {};
    console.log("Follow-ups carregados:", all);

    // 1. Obter todas as chaves (keys) do objeto 'all'
    const allKeys = Object.keys(all);

    // 2. Filtrar as chaves que começam com a 'key' fornecida
    const filteredKeys = allKeys.filter(currentKey => {
      // Verifica se a chave atual começa com o valor da 'key' fornecida
      return currentKey.startsWith(key);
    });

    // 3. Juntar todos os arrays de follow-ups das chaves filtradas
    let combinedFollowups = [];
    filteredKeys.forEach(filteredKey => {
      // Adiciona (concatena) os follow-ups da chave filtrada ao array final
      combinedFollowups = combinedFollowups.concat(all[filteredKey]);
    });
    
    // 4. Retornar a lista combinada de follow-ups
    console.log("Retornando follow-ups combinados para chave/prefixo:", key, combinedFollowups);
    return combinedFollowups;
    
  } catch (e) {
    console.warn("Erro ao buscar follow-ups", e);
    return [];
  }
}

export async function saveFollowups(key, ids) {
  try {
    const all = await load(STORAGE_KEYS.FOLLOWUPS) || {};
    all[key] = ids;
    await save(STORAGE_KEYS.FOLLOWUPS, all);
  } catch (e) {
    console.warn("Erro ao salvar follow-ups", e);
  }
}

export async function deleteFollowups(keyPrefix) {
  try {
    const all = await load(STORAGE_KEYS.FOLLOWUPS) || {};
    
    const keysToDelete = Object.keys(all).filter(currentKey => {
      return currentKey.startsWith(keyPrefix);
    });
    
    keysToDelete.forEach(key => {
        delete all[key];
    });
    
    await save(STORAGE_KEYS.FOLLOWUPS, all);
    console.log(`Deletados ${keysToDelete.length} follow-ups com prefixo:`, keyPrefix);
  } catch (e) {
    console.warn("Erro ao deletar follow-ups", e);
  }
}

// Funções específicas para configurações
export async function loadSettings() {
  const settings = await load(STORAGE_KEYS.SETTINGS);
  return settings || {};
}

// Funções específicas para configurações
export async function loadFollowups() {
  const followups = await load(STORAGE_KEYS.FOLLOWUPS);
  return followups || {};
}

export async function saveSettings(settings) {
  await save(STORAGE_KEYS.SETTINGS, settings);
}