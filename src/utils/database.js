// src/utils/database.js

export const STORAGE_KEYS = {
  MEDS: "@tomou:meds",
  EVENTS: "@tomou:events",
  FOLLOWUPS: "@tomou:followups",
  SETTINGS: "@tomou:settings"
};

// Schema dos medicamentos
export const MED_SCHEMA = {
  id: "",
  name: "",
  times: [],
  intervalHours: null,
  icon: "pill",
  color: "#4f46e5",
  startDate: "",
  endDate: null,
  pauseDays: 0
};

// Schema dos eventos de tomada
export const EVENT_SCHEMA = {
  id: "",
  medId: "",
  medName: "",
  time: "",
  takenAt: ""
};

// Schema de follow-ups
export const FOLLOWUP_SCHEMA = {
  id: "",
  medId: "",
  time: "",
  date: "",
  notificationIds: []
};