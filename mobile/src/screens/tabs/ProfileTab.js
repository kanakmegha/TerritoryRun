import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Image } from 'react-native';
import { useGameStore } from '../../hooks/useGameStore';
import { User, LogOut, Shield, Award, MapPin, Zap, Target } from 'lucide-react-native';

const ProfileTab = () => {
    const { user, logout } = useGameStore();

    // Calculate level based on territories
    const userLevel = Math.floor((user?.stats?.territories || 0) / 5) + 1;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.terminalLine}>$ cat agent_profile.dna --live</Text>
                <Text style={styles.title}>AGENT PROFILE</Text>
            </View>

            <View style={styles.profileCard}>
                <View style={[styles.avatarGlow, { borderColor: user?.color || '#00f3ff' }]}>
                    {user?.imageUrl ? (
                        <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
                    ) : (
                        <User color={user?.color || '#00f3ff'} size={40} />
                    )}
                </View>
                <View style={styles.profileInfo}>
                    <Text style={styles.username}>{user?.username || 'GHOST_RUNNER'}</Text>
                    <Text style={[styles.levelTag, { color: '#FFB800' }]}>
                        LEVEL {userLevel} - {userLevel > 10 ? 'TERRITORY BARON' : 'RECON AGENT'}
                    </Text>
                    <Text style={[styles.identityTag, { color: user?.color || '#00f3ff' }]}>
                        [ID: {user?.id ? user.id.slice(-8).toUpperCase() : 'ANONYMOUS'}]
                    </Text>
                </View>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Shield color="#00f3ff" size={20} />
                    <Text style={styles.statLabel}>DOMINANCE</Text>
                    <Text style={styles.statValue}>{user?.stats?.territories || 0}</Text>
                    <Text style={styles.statSub}>Sectors Held</Text>
                </View>
                
                <View style={styles.statBox}>
                    <Zap color="#ff00ff" size={20} />
                    <Text style={styles.statLabel}>VITALITY</Text>
                    <Text style={styles.statValue}>
                        {((user?.stats?.distance || 0) / 1000).toFixed(1)}
                    </Text>
                    <Text style={styles.statSub}>KM Traversed</Text>
                </View>
            </View>

            <View style={styles.sectionHeader}>
                <Target color="#00f3ff" size={16} />
                <Text style={styles.sectionTitle}>BATTLE RECORDS</Text>
            </View>

            <View style={styles.battleGrid}>
                <View style={styles.battleStat}>
                    <Text style={styles.battleLabel}>CONQUESTS</Text>
                    <Text style={styles.battleValue}>{user?.stats?.conquests || 0}</Text>
                </View>
                <View style={styles.battleStat}>
                    <Text style={styles.battleLabel}>DEFENSES</Text>
                    <Text style={styles.battleValue}>{user?.stats?.defenses || 0}</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                <LogOut color="#ff3333" size={20} />
                <Text style={styles.logoutText}>TERMINATE SESSION</Text>
            </TouchableOpacity>

            <Text style={styles.footer}>NEXUS OS v4.2.0 - SECURE UPLINK ACTIVE</Text>
        </ScrollView>
    );
};

// ... Styles stay mostly the same as your previous ProfileTab ...
const styles = StyleSheet.create({
    // Keep your existing styles but add/edit these:
    container: { flex: 1, backgroundColor: '#000', padding: 20 },
    header: { marginTop: 40, marginBottom: 25 },
    terminalLine: { color: '#00f3ff', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', opacity: 0.7, marginBottom: 5 },
    title: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 4 },
    profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 20, borderLeftWidth: 5, borderLeftColor: '#00f3ff', marginBottom: 30 },
    avatarGlow: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 20, overflow: 'hidden' },
    avatarImage: { width: 70, height: 70 },
    profileInfo: { flex: 1 },
    username: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    levelTag: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },
    identityTag: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', opacity: 0.6 },
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    statBox: { width: '48%', backgroundColor: '#0a0a0a', padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
    statLabel: { color: '#888', fontSize: 10, letterSpacing: 2, marginTop: 8 },
    statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    statSub: { color: '#444', fontSize: 10 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { color: '#00f3ff', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, marginLeft: 10 },
    battleGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    battleStat: { width: '48%', padding: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
    battleLabel: { color: '#444', fontSize: 9 },
    battleValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderWidth: 1, borderColor: '#ff3333', backgroundColor: 'rgba(255, 51, 51, 0.05)', marginBottom: 30 },
    logoutText: { color: '#ff3333', fontWeight: 'bold', letterSpacing: 2, marginLeft: 10 },
    footer: { textAlign: 'center', color: '#222', fontSize: 10, marginBottom: 40 }
});

export default ProfileTab;