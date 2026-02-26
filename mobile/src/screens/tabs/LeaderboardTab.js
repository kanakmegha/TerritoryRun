import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Trophy, Medal, User } from 'lucide-react-native';

const LeaderboardTab = () => {
    // Mock data for now
    const leaders = [
        { id: 1, name: 'Commander Alpha', score: 450, rank: 1, area: '24.5 km²' },
        { id: 2, name: 'StealthRunner', score: 380, rank: 2, area: '18.2 km²' },
        { id: 3, name: 'TerritoryKing', score: 310, rank: 3, area: '15.7 km²' },
        { id: 4, name: 'RoadWarrior', score: 290, rank: 4, area: '14.1 km²' },
        { id: 5, name: 'UrbanScout', score: 250, rank: 5, area: '12.8 km²' },
    ];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Trophy color="#FFB800" size={40} />
                <Text style={styles.title}>GLOBAL LEADERBOARD</Text>
                <Text style={styles.subtitle}>Top Conquerors</Text>
            </View>

            <View style={styles.listContainer}>
                {leaders.map((leader) => (
                    <View key={leader.id} style={styles.leaderCard}>
                        <View style={styles.rankContainer}>
                            {leader.rank <= 3 ? (
                                <Medal color={leader.rank === 1 ? '#FFD700' : leader.rank === 2 ? '#C0C0C0' : '#CD7F32'} size={24} />
                            ) : (
                                <Text style={styles.rankText}>{leader.rank}</Text>
                            )}
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{leader.name}</Text>
                            <Text style={styles.userArea}>{leader.area} controlled</Text>
                        </View>
                        <View style={styles.scoreContainer}>
                            <Text style={styles.scoreText}>{leader.score}</Text>
                            <Text style={styles.scoreLabel}>PTS</Text>
                        </View>
                    </View>
                ))}
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
    },
    listContainer: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        overflow: 'hidden',
    },
    leaderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    rankContainer: {
        width: 40,
        alignItems: 'center',
    },
    rankText: {
        color: '#888',
        fontSize: 18,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
        marginLeft: 15,
    },
    userName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    userArea: {
        color: '#666',
        fontSize: 12,
    },
    scoreContainer: {
        alignItems: 'flex-end',
    },
    scoreText: {
        color: '#00f3ff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    scoreLabel: {
        color: '#444',
        fontSize: 10,
    },
});

export default LeaderboardTab;
