import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useGameStore } from '../../hooks/useGameStore';

const EmpireTab = () => {
    const { user } = useGameStore();

    // Helper to format large numbers or handle missing stats
    const stats = user?.stats || {};
    
    // Calculate display values
    const totalArea = stats.distance ? (stats.distance / 1000).toFixed(2) : "0.00";
    const totalTerritories = stats.territories || 0;
    const userLevel = Math.floor(totalTerritories / 5) + 1; // Basic level logic

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>MY EMPIRE</Text>
                <Text style={styles.subtitle}>Profile</Text>
            </View>

            <View style={styles.profileCard}>
                {/* Use Clerk's Profile Image if available, otherwise placeholder */}
                {user?.imageUrl ? (
                    <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: user?.color || '#333' }]} />
                )}
                
                <View style={styles.profileInfo}>
                    <Text style={styles.username}>{user?.username || user?.firstName || 'Agent'}</Text>
                    <Text style={styles.levelText}>Level {userLevel} - Territory Explorer</Text>
                </View>
            </View>

            <View style={styles.grid}>
                <View style={styles.gridItem}>
                    <Text style={styles.gridValue}>{totalArea}</Text>
                    <Text style={styles.gridLabel}>Total Distance (km)</Text>
                </View>
                <View style={styles.gridItem}>
                    <Text style={styles.gridValue}>{totalTerritories}</Text>
                    <Text style={styles.gridLabel}>Territories Owned</Text>
                </View>
                <View style={styles.gridItem}>
                    <Text style={styles.gridValue}>{stats.conquests || 0}</Text>
                    <Text style={styles.gridLabel}>Conquests (Wins)</Text>
                </View>
                <View style={styles.gridItem}>
                    <Text style={styles.gridValue}>{stats.defenses || 0}</Text>
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
        borderLeftWidth: 4,
        borderLeftColor: '#FFB800', // You can set this to user.color
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 15,
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
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