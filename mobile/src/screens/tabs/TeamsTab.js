import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Users, Shield, Plus, TrendingUp } from 'lucide-react-native';

const TeamsTab = () => {
    // Mock data for teams
    const teams = [
        { id: 1, name: 'Urban Guardians', members: 5, strength: 42, territory: 'Central Park' },
        { id: 2, name: 'Night Runners', members: 3, strength: 28, territory: 'Riverside' },
        { id: 3, name: 'Road Reapers', members: 8, strength: 56, territory: 'Financial District' },
    ];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Users color="#FFB800" size={40} />
                <Text style={styles.title}>SQUAD COMMAND</Text>
                <Text style={styles.subtitle}>Form alliances, conquer stronger areas</Text>
            </View>

            <TouchableOpacity style={styles.createTeamBtn}>
                <Plus color="#000" size={24} />
                <Text style={styles.createTeamText}>CREATE NEW SQUAD</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Active Squads</Text>
            {teams.map((team) => (
                <View key={team.id} style={styles.teamCard}>
                    <View style={styles.teamHeader}>
                        <View>
                            <Text style={styles.teamName}>{team.name}</Text>
                            <Text style={styles.teamTerritory}>Protecting {team.territory}</Text>
                        </View>
                        <Shield color="#00f3ff" size={24} />
                    </View>
                    
                    <View style={styles.teamStats}>
                        <View style={styles.statItem}>
                            <Users color="#888" size={14} />
                            <Text style={styles.statValue}>{team.members} Members</Text>
                        </View>
                        <View style={styles.statItem}>
                            <TrendingUp color="#888" size={14} />
                            <Text style={styles.statValue}>Strength: {team.strength}</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.joinBtn}>
                        <Text style={styles.joinBtnText}>REQUEST TO JOIN</Text>
                    </TouchableOpacity>
                </View>
            ))}
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
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 30,
    },
    title: {
        color: '#FFB800',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 10,
    },
    subtitle: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
    },
    createTeamBtn: {
        backgroundColor: '#FFB800',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
    },
    createTeamText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    teamCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    teamHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    teamName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    teamTerritory: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
    },
    teamStats: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 20,
        marginBottom: 20,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        color: '#ccc',
        fontSize: 14,
    },
    joinBtn: {
        backgroundColor: '#222',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    joinBtnText: {
        color: '#FFB800',
        fontSize: 14,
        fontWeight: 'bold',
    },
});

export default TeamsTab;
