import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useGameStore } from '../hooks/useGameStore';
import { MapPin, ChevronLeft } from 'lucide-react-native';
import axios from 'axios';
import VectorMap from '../components/Map/VectorMap';

const RouteSuggestion = ({ navigation }) => {
    const { targetDistance, setTargetDistance, suggestedRoutes, setSuggestedRoutes, startTracking, lastPosition } = useGameStore();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchRoutes = async () => {
            setLoading(true);
            try {
                const res = await axios.post('/api/game/suggest', {
                    targetDistance,
                    lat: lastPosition?.lat || 0,
                    lng: lastPosition?.lng || 0
                });
                if (res.data.success) {
                    setSuggestedRoutes(res.data.routes);
                }
            } catch (err) {
                console.error("Failed to fetch suggested routes", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRoutes();
    }, [targetDistance, lastPosition]);

    const handleStartRun = () => {
        if (isOffRoad) {
            alert("🚫 Off-Road Detected: You are currently not on a recognized road. Distance may not be captured until you reach a road.");
        }
        startTracking('claim');
        navigation.navigate('ActiveRun');
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft color="#fff" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Select Route</Text>
            </View>

            {/* Live Minimap */}
            <View style={styles.mapPlaceholder}>
                <VectorMap minimap={true} />
            </View>

            <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                    <Text style={styles.sliderLabel}>Target Distance</Text>
                    <Text style={styles.sliderValue}>{targetDistance} km</Text>
                </View>
                {/* React Native core Slider is deprecated, using simple buttons as a fallback if not installed */}
                <View style={styles.distanceSelector}>
                    {[3, 5, 8, 12].map(dist => (
                        <TouchableOpacity 
                            key={dist} 
                            style={[styles.distBtn, targetDistance === dist && styles.distBtnActive]}
                            onPress={() => setTargetDistance(dist)}
                        >
                            <Text style={[styles.distBtnText, targetDistance === dist && styles.distBtnTextActive]}>
                                {dist} km
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <Text style={styles.sectionTitle}>Suggested Loops</Text>
            
            {suggestedRoutes.map(route => (
                <TouchableOpacity key={route.id} style={styles.loopCard}>
                    <View style={styles.loopIconWrapper}>
                        <MapPin color="#FFB800" size={20} />
                    </View>
                    <View style={styles.loopInfo}>
                        <Text style={styles.loopName}>{route.name}</Text>
                        <Text style={styles.loopMeta}>{route.type} • {route.distance} km</Text>
                    </View>
                </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.startBtn} onPress={handleStartRun}>
                <Text style={styles.startBtnText}>Start Run</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111111',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 20,
    },
    backBtn: {
        marginRight: 15,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    mapPlaceholder: {
        height: 200,
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        marginBottom: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden',
    },
    mapText: {
        color: '#666',
    },
    sliderContainer: {
        marginBottom: 30,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    sliderLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    sliderValue: {
        color: '#FFB800',
        fontSize: 16,
        fontWeight: 'bold',
    },
    distanceSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    distBtn: {
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    distBtnActive: {
        borderColor: '#FFB800',
        backgroundColor: 'rgba(255, 184, 0, 0.1)',
    },
    distBtnText: {
        color: '#888',
        fontWeight: 'bold',
    },
    distBtnTextActive: {
        color: '#FFB800',
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    loopCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    loopIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    loopName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loopMeta: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
    },
    startBtn: {
        backgroundColor: '#FFB800',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    startBtnText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
    },
    mapPlaceholderText: {
        color: '#00f3ff',
        fontSize: 13,
        marginTop: 10,
    }
});

export default RouteSuggestion;
