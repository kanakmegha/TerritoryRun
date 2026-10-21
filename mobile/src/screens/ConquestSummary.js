import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useGameStore } from '../hooks/useGameStore';
import { Home, Share2 } from 'lucide-react-native';
import { formatDistance } from '../utils/distanceFormat';

const ConquestSummary = ({ navigation }) => {
    const { user, currentRun, retryActivitySubmission, indoorTestMode } = useGameStore();
    const isTestActivity = indoorTestMode || currentRun?.outcome?.isTest === true;
    const distanceMeters = currentRun?.distance || 0;
    const { value: distanceValue, unit: distanceUnit } = formatDistance(distanceMeters);
    const resultTitle = currentRun?.submissionStatus === 'processed' ? 'NEW TERRITORY ACQUIRED'
        : currentRun?.submissionStatus === 'rejected' ? 'RUN NOT CLAIMED'
        : ['pending', 'uploading'].includes(currentRun?.submissionStatus) ? 'UPLOAD PENDING' : 'RESULT UNAVAILABLE';
    
    // Flip Animation Value (0 to 180 degrees)
    const [flipAnim] = useState(() => new Animated.Value(0));

    useEffect(() => {
        // Trigger flip animation after a short delay for dramatic effect
        setTimeout(() => {
            Animated.spring(flipAnim, {
                toValue: 180,
                friction: 8,
                tension: 10,
                useNativeDriver: true,
            }).start();
        }, 500);
    }, [flipAnim]);

    const frontInterpolate = flipAnim.interpolate({
        inputRange: [0, 90, 180],
        outputRange: ['0deg', '90deg', '90deg'],
    });

    const backInterpolate = flipAnim.interpolate({
        inputRange: [0, 90, 180],
        outputRange: ['180deg', '270deg', '360deg'],
    });

    const frontAnimatedStyle = {
        transform: [{ rotateY: frontInterpolate }]
    };

    const backAnimatedStyle = {
        transform: [{ rotateY: backInterpolate }]
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>OPERATION COMPLETE</Text>
            </View>

            <View style={styles.cardContainer}>
                {/* Front of Card (Before Flip) */}
                <Animated.View style={[styles.card, styles.cardFront, frontAnimatedStyle]}>
                    <Text style={styles.loadingText}>Processing Spatial Data...</Text>
                </Animated.View>

                {/* Back of Card (After Flip) */}
                <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle]}>
                    <Text style={styles.territoryTitle}>{resultTitle}{isTestActivity ? ' (TEST)' : ''}</Text>
                    {isTestActivity && (
                        <Text style={styles.testActivityNote}>Indoor test activity — no real territory awarded.</Text>
                    )}
                    {currentRun?.submissionStatus === 'pending' && (
                        <Text style={styles.loadingText}>Your recorded GPS trace is saved on this device.</Text>
                    )}
                    {currentRun?.submissionStatus === 'rejected' && (
                        <Text style={styles.loadingText}>{currentRun?.outcome?.message || 'This activity did not meet the claim rules.'}</Text>
                    )}
                    
                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{distanceValue}</Text>
                            <Text style={styles.statLabel}>{distanceUnit}</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{currentRun?.pace?.toFixed(1) || '0.0'}</Text>
                            <Text style={styles.statLabel}>AVG PACE</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{currentRun?.outcome?.strength_count || 0}</Text>
                            <Text style={styles.statLabel}>TERRITORY</Text>
                        </View>
                    </View>

                    {currentRun?.submissionStatus === 'processed' && (
                        <View style={styles.ownerTag}>
                            <View style={[styles.colorDot, { backgroundColor: user?.color || '#00f3ff' }]} />
                            <Text style={styles.ownerText}>{user?.username || 'Agent'}'s Domain</Text>
                        </View>
                    )}
                </Animated.View>
            </View>

            <View style={styles.actionRow}>
                {currentRun?.submissionStatus === 'pending' && (
                    <TouchableOpacity style={styles.actionBtn} onPress={retryActivitySubmission}>
                        <Text style={styles.actionBtnText}>Retry Upload</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('CommandCenter')}
                >
                    <Home color="#000" size={24} />
                    <Text style={styles.actionBtnText}>Command Center</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.iconBtn}>
                    <Share2 color="#FFB800" size={24} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111111',
        padding: 20,
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    header: {
        marginTop: 60,
    },
    title: {
        color: '#FFB800',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 3,
        textAlign: 'center',
    },
    cardContainer: {
        width: '100%',
        height: 400,
        alignItems: 'center',
        justifyContent: 'center',
        perspective: 1000,
    },
    card: {
        width: '90%',
        height: '100%',
        borderRadius: 20,
        position: 'absolute',
        backfaceVisibility: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        borderWidth: 2,
    },
    cardFront: {
        backgroundColor: '#1a1a1a',
        borderColor: '#333',
    },
    cardBack: {
        backgroundColor: '#0a0a0a',
        borderColor: '#00ffea',
        shadowColor: '#00ffea',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    loadingText: {
        color: '#888',
        fontSize: 16,
        letterSpacing: 2,
    },
    testActivityNote: {
        color: '#FFB800',
        fontSize: 11,
        textAlign: 'center',
        marginBottom: 20,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    territoryTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 40,
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 40,
    },
    statBox: {
        alignItems: 'center',
    },
    statValue: {
        color: '#FFB800',
        fontSize: 32,
        fontWeight: 'bold',
    },
    statLabel: {
        color: '#888',
        fontSize: 12,
        marginTop: 5,
        letterSpacing: 1,
    },
    ownerTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    ownerText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    actionRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        marginBottom: 40,
        paddingHorizontal: 10,
    },
    actionBtn: {
        flex: 1,
        backgroundColor: '#FFB800',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginRight: 15,
    },
    actionBtnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 10,
    },
    iconBtn: {
        backgroundColor: '#1a1a1a',
        padding: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    }
});

export default ConquestSummary;
