// mobile/src/components/Dashboard/StatsCard.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StatsCard = ({ label, value, icon: Icon }) => {
  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        {Icon && <Icon size={24} color="#00f3ff" />}
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(20, 20, 20, 0.8)',
    borderColor: '#00f3ff',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 5,
    shadowColor: '#00f3ff',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    flex: 1, // allows it to scale in grid
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#00f3ff',
    textShadowRadius: 5,
  },
  label: {
    fontSize: 8,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
});

export default StatsCard;
