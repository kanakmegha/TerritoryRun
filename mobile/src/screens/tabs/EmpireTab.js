import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useGameStore } from '../../hooks/useGameStore';

const EmpireTab = () => {
    const { user } = useGameStore();

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>MY EMPIRE</Text>
                <Text style={styles.subtitle}>Profile</Text>
            </View>

            <View style={styles.profileCard}>
                <View style={styles.avatarPlaceholder} />
                <View style={styles.profileInfo}>
                    <Text style={styles.username}>{user?.username || 'Agent'}</Text>
                    <Text style={styles.levelText}>Level 12 - Territory Baron</Text>
                </View>
            </View>

            <View style={styles.grid}>
                <View style={styles.gridItem}>
                    <Text style={styles.gridValue}>16.7</Text>
                    <Text style={styles.gridLabel}>Total Area (km²)</Text>
                </View>
                <View style={styles.gridItem}>
                    <Text style={styles.gridValue}>42</Text>
                    <Text style={styles.gridLabel}>Strength [STR]</Text>
                </View>
                <View style={styles.gridItem}>
                    <Text style={styles.gridValue}>18</Text>
                    <Text style={styles.gridLabel}>Conquests (Wins)</Text>
                </View>
                <View style={styles.gridItem}>
                    <Text style={styles.gridValue}>3</Text>
                    <Text style={styles.gridLabel}>Defenses (Held)</Text>
                </View>
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
    profileCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#333',
        marginRight: 15,
    },
    profileInfo: {
        flex: 1,
    },
    username: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    levelText: {
        color: '#FFB800',
        fontSize: 14,
        marginTop: 4,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    gridItem: {
        backgroundColor: '#1a1a1a',
        width: '48%',
        borderRadius: 12,
        padding: 20,
        marginBottom: 15,
    },
    gridValue: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    gridLabel: {
        color: '#888',
        fontSize: 12,
    }
});

export default EmpireTab;
