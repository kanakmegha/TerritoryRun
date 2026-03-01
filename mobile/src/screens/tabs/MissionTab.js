import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useGameStore } from '../../hooks/useGameStore';
import { Play, Shield, MapPin } from 'lucide-react-native';
import VectorMap from '../../components/Map/VectorMap';

const MissionTab = ({ navigation }) => {
    const { user, targetDistance, setTargetDistance } = useGameStore();

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>COMMAND CENTER</Text>
                <Text style={styles.subtitle}>Territory Run</Text>
            </View>

            <View style={styles.statsCard}>
                <View style={styles.statRow}>
                    <View>
                        <Text style={styles.statLabel}>Total Area Controlled</Text>
                        <Text style={styles.statValue}>{(user?.stats?.distance || 0).toFixed(1)} <Text style={styles.unit}>km²</Text></Text>
                    </View>
                    <Shield color="#FFB800" size={32} />
                </View>
                <View style={styles.subStatsRow}>
                    <View>
                        <Text style={styles.subStatLabel}>Total Strength</Text>
                        <Text style={styles.subStatValue}>{user?.stats?.territories || 0}</Text>
                    </View>
                    <View>
                        <Text style={styles.subStatLabel}>Active Threats</Text>
                        <Text style={styles.subThreatValue}>2</Text>
                    </View>
                </View>
            </View>

            {/* Live Minimap */}
            <View style={styles.minimapContainer}>
                <VectorMap minimap={true} />
            </View>

            <TouchableOpacity 
                style={styles.conquestBtn}
                onPress={() => navigation.navigate('RouteSuggestion')}
            >
                <Play color="#000" size={24} />
                <View style={styles.conquestBtnTextContainer}>
                    <Text style={styles.conquestBtnTitle}>New Conquest</Text>
                    <Text style={styles.conquestBtnSubtitle}>Claim unclaimed territory</Text>
                </View>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Fortify Existing</Text>
            <View style={styles.fortifyCard}>
                <View>
                    <Text style={styles.fortifyTitle}>Central Park Loop</Text>
                    <Text style={styles.fortifySubtitle}>Str: 8 • 12.5 km²</Text>
                </View>
                <TouchableOpacity style={styles.runBtn}>
                    <Text style={styles.runBtnText}>Run</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111111',
        padding: 20,
    },
    header: {
        marginBottom: 20,
        marginTop: 40,
    },
    title: {
        color: '#888',
        fontSize: 12,
        letterSpacing: 2,
    },
    subtitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    statsCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    statLabel: {
        color: '#888',
        fontSize: 14,
    },
    statValue: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    unit: {
        fontSize: 16,
        color: '#666',
    },
    subStatsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 40,
    },
    subStatLabel: {
        color: '#888',
        fontSize: 12,
        marginBottom: 4,
    },
    subStatValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    subThreatValue: {
        color: '#ff4444',
        fontSize: 18,
        fontWeight: 'bold',
    },
    minimapContainer: {
        height: 200,
        backgroundColor: '#222',
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
    },
    minimapText: {
        color: '#666',
    },
    conquestBtn: {
        backgroundColor: '#FFB800',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    conquestBtnTextContainer: {
        marginLeft: 15,
    },
    conquestBtnTitle: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
    },
    conquestBtnSubtitle: {
        color: '#333',
        fontSize: 14,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    fortifyCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 40,
    },
    fortifyTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    fortifySubtitle: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
    },
    runBtn: {
        backgroundColor: '#333',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    runBtnText: {
        color: '#FFB800',
        fontWeight: 'bold',
    }
});

export default MissionTab;
