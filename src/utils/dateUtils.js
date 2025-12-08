// src/utils/dateUtils.js

// Formatar data atual com offset
export function getTodayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// Formatar hora
export function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Gerar horários a partir de intervalo
export function generateTimesFromInterval(interval, startInfo) {
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

// Verificar se deve tomar medicamento na data
export function shouldTakeMedOnDate(med, dateStr) {
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

// Formatar data para exibição (DD/MM/AAAA)
export function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  return dateStr.split('-').reverse().join('/');
}

// Verificar se é hoje
export function isToday(dateStr) {
  return dateStr === getTodayStr();
}

// Verificar se é ontem/amanhã
export function getRelativeDayLabel(dateOffset) {
  switch (dateOffset) {
    case 0: return "HOJE";
    case -1: return "ONTEM";
    case 1: return "AMANHÃ";
    default: return "";
  }
}