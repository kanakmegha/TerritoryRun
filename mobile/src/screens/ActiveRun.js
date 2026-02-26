import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useGameStore } from '../hooks/useGameStore';
import VectorMap from '../components/Map/VectorMap';
import { AlertCircle, Square, Shield, Swords } from 'lucide-react-native';

const ActiveRun = ({ navigation }) => {
    const { 
        currentRun, stopTracking, isLoopClosable, alerts,
        activeGameMode, attackTarget 
    } = useGameStore();

    const handleStop = async () => {
        await stopTracking();
        navigation.navigate('ConquestSummary');
    };

    return (
        <View style={styles.container}>
            <View style={styles.mapContainer}>
                <VectorMap />
            </View>

            <View style={styles.hudOverlay}>
                <View style={styles.metricsRow}>
                    <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Distance</Text>
                        <Text style={styles.metricValue}>
                            {(currentRun.distance / 1000).toFixed(2)}
                            <Text style={styles.unit}> km</Text>
                        </Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Pace</Text>
                        <Text style={styles.metricValue}>
                            {currentRun.pace > 0 && currentRun.pace < 60 ? currentRun.pace.toFixed(1) : '--'}
                            <Text style={styles.unit}> /km</Text>
                        </Text>
                    </View>
                </View>

                {/* Territory Interaction Progress */}
                {attackTarget && (
                    <View style={styles.attackBox}>
                        <View style={styles.attackHeader}>
                            {activeGameMode === 'fortify' ? (
                                <Shield color="#00ffea" size={16} />
                            ) : (
                                <Swords color="#ff4444" size={16} />
                            )}
                            <Text style={styles.attackTitle}>
                                {activeGameMode === 'fortify' ? 'FORTIFYING AREA' : 'SIPHONING ENEMY'}
                            </Text>
                            <Text style={styles.attackPercent}>
                                {Math.floor((attackTarget.progress / attackTarget.required) * 100)}%
                            </Text>
                        </View>
                        <View style={styles.progressBarBg}>
                            <View 
                                style={[
                                    styles.progressBarFill, 
                                    { 
                                        width: `${Math.min(100, (attackTarget.progress / attackTarget.required) * 100)}%`,
                                        backgroundColor: activeGameMode === 'fortify' ? '#00ffea' : '#ff4444'
                                    }
                                ]} 
                            />
                        </View>
                    </View>
                )}

                {/* Live System Alerts */}
                {alerts.length > 0 && (
                    <View style={styles.alertBox}>
                        <AlertCircle color="#FFB800" size={16} style={{ marginRight: 8 }} />
                        <Text style={styles.alertText}>{alerts[0].message}</Text>
                    </View>
                )}

                {/* Primary Interaction Area */}
                <View style={styles.interactionArea}>
                    {isLoopClosable ? (
                        <TouchableOpacity style={[styles.stopBtn, styles.closableBtn]} onPress={handleStop}>
                            <Text style={styles.closableBtnText}>Loop Closable! Tap to Claim.</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
                            <Square color="#fff" size={20} fill="#fff" />
                            <Text style={styles.stopBtnText}>End Run</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    mapContainer: {
        flex: 1,
    },
    hudOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 40,
        backgroundColor: 'rgba(10, 10, 10, 0.85)',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    metricsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    metricCard: {
        width: '48%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    metricLabel: {
        color: '#888',
        fontSize: 12,
        marginBottom: 5,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    metricValue: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    unit: {
        fontSize: 14,
        color: '#666',
    },
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 184, 0, 0.1)',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 184, 0, 0.3)',
        marginBottom: 20,
    },
    alertText: {
        color: '#FFB800',
        fontWeight: 'bold',
        fontSize: 14,
    },
    interactionArea: {
        alignItems: 'center',
    },
    stopBtn: {
        backgroundColor: '#ff4444',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 30,
        width: '100%',
    },
    stopBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    closableBtn: {
        backgroundColor: '#00ffea',
    },
    closableBtnText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
    },
    attackBox: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    attackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    attackTitle: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 8,
        flex: 1,
        letterSpacing: 1,
    },
    attackPercent: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: 'monospace',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    }
});

export default ActiveRun;
