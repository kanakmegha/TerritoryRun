// mobile/src/components/Dashboard/LiveRunCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../hooks/useGameStore';
import { Navigation, Activity, MapPin } from 'lucide-react-native';

const LiveRunCard = () => {
    const { currentRun, startContinuousRun, stopContinuousRun } = useGameStore();

    if (!currentRun.isActive) {
        return (
            <View style={styles.containerInactive}>
                <TouchableOpacity style={styles.startBtn} onPress={startContinuousRun}>
                    <Navigation size={20} color="#000" />
                    <Text style={styles.startBtnText}>START TRACKING</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const formatDistance = (meters) => {
        if (meters < 1000) return `${meters.toFixed(0)} m`;
        return `${(meters / 1000).toFixed(2)} km`;
    };

    const distanceDisplay = formatDistance(currentRun.distance || 0);
    const paceMinKm = currentRun.pace > 0 ? currentRun.pace.toFixed(1) : '--';

    return (
        <View style={styles.containerActive}>
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Activity size={16} color="#00f3ff" />
                    <View>
                        <Text style={styles.statLabel}>Distance</Text>
                        <Text style={styles.statValue}>{distanceDisplay}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.statItem}>
                    <Navigation size={16} color="#00f3ff" />
                    <View>
                        <Text style={styles.statLabel}>Pace</Text>
                        <Text style={styles.statValue}>{paceMinKm} min/k</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.statItem}>
                    <MapPin size={16} color="#00f3ff" />
                    <View>
                        <Text style={styles.statLabel}>Tiles</Text>
                        <Text style={styles.statValue}>{currentRun.tilesCaptured || 0}</Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.stopBtn} onPress={stopContinuousRun}>
                <Text style={styles.stopBtnText}>STOP RUN</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    containerInactive: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        zIndex: 2000,
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: '#00f3ff',
        borderWidth: 2,
        borderRadius: 12,
        padding: 10,
        shadowColor: '#00f3ff',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        minWidth: 200,
        alignItems: 'center',
    },
    startBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#00f3ff',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        gap: 10,
        width: '100%',
    },
    startBtnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    },
    containerActive: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        zIndex: 2000,
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderColor: '#00f3ff',
        borderWidth: 2,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#00f3ff',
        shadowOpacity: 0.5,
        shadowRadius: 15,
        width: '90%',
        maxWidth: 450,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statLabel: {
        fontSize: 10,
        color: '#888',
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#00f3ff',
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(0,255,234,0.2)',
    },
    stopBtn: {
        width: '100%',
        backgroundColor: 'rgba(255,0,85,0.2)',
        borderColor: '#ff00ff',
        borderWidth: 2,
        padding: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    stopBtnText: {
        color: '#ff00ff',
        fontWeight: 'bold',
        fontSize: 14,
    }
});

export default LiveRunCard;
