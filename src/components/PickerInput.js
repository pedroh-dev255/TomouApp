// src/components/PickerInput.js
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { formatTime, formatDisplayDate } from "../utils/dateUtils";

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
  
  const displayValue = value ? (mode === 'date' ? formatDisplayDate(value) : value) : placeholder;

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

const styles = {
  label: { fontSize: 12, fontWeight: '600', color:'#6b7280', marginBottom:4 },
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
};

export default PickerInput;