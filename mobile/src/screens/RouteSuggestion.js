import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useGameStore } from '../hooks/useGameStore';
import { MapPin, ChevronLeft } from 'lucide-react-native';
import api from '../utils/api';
import VectorMap from '../components/Map/VectorMap';
import { buildRouteSuggestionRequest, normalizeSuggestedRoutes, hasUsableCoordinates } from '../utils/routeSuggestions';

const RouteSuggestion = ({ navigation }) => {
    const { 
        targetDistance, setTargetDistance, 
        suggestedRoutes, setSuggestedRoutes, selectedRoute, setSelectedRoute,
        startTracking, lastPosition, currentRun, retryActivitySubmission
    } = useGameStore();

    const [routeState, setRouteState] = useState('waiting');
    const [routeError, setRouteError] = useState('');
    const [starting, setStarting] = useState(false);
    const [startError, setStartError] = useState('');
    const [retryIndex, setRetryIndex] = useState(0);
    const originRef = useRef(lastPosition);
    const previousTargetRef = useRef(targetDistance);
    const startingRef = useRef(false);
    originRef.current = lastPosition;

    const locationAvailable = hasUsableCoordinates(lastPosition);

    useEffect(() => {
        if (previousTargetRef.current !== targetDistance) {
            previousTargetRef.current = targetDistance;
            setSelectedRoute(null);
        }
    }, [targetDistance, setSelectedRoute]);

    useEffect(() => {
        if (!locationAvailable) {
            setRouteState('waiting');
            setSuggestedRoutes([]);
            return;
        }

        const requestBody = buildRouteSuggestionRequest(originRef.current, targetDistance);
        if (!requestBody) return;
        let cancelled = false;
        setRouteState('loading');
        setRouteError('');
        api.post('/api/game/suggest', requestBody).then((res) => {
            if (cancelled) return;
            const routes = normalizeSuggestedRoutes(res.data?.routes);
            if (res.data?.success && routes.length) {
                setSuggestedRoutes(routes);
                setRouteState('loaded');
            } else {
                setSuggestedRoutes([]);
                setRouteState('error');
                setRouteError(res.data?.message || 'No route suggestions are available. Try again.');
            }
        }).catch((err) => {
            if (cancelled) return;
            setSuggestedRoutes([]);
            setRouteState('error');
            setRouteError(err.response?.data?.message || 'Could not load routes. Check your connection and retry.');
        });

        return () => {
            cancelled = true;
        };
    }, [targetDistance, locationAvailable, retryIndex, setSuggestedRoutes]);

    const handleStartRun = async () => {
        if (starting || startingRef.current) return;
        startingRef.current = true;
        setStarting(true);
        setStartError('');
        if (currentRun?.isActive) {
            navigation.navigate('ActiveRun');
            startingRef.current = false;
            setStarting(false);
            return;
        }
        if (['pending', 'uploading'].includes(currentRun?.submissionStatus)) {
            const result = await retryActivitySubmission();
            if (result?.status === 'processed' || result?.status === 'rejected') {
                navigation.navigate('ConquestSummary');
                startingRef.current = false;
                setStarting(false);
                return;
            }
            startingRef.current = false;
            setStarting(false);
            setStartError(result?.status === 'pending'
                ? 'Upload is still pending. Keep this activity saved and retry when the connection is available.'
                : 'There is no saved activity to retry.');
            return;
        }
        try {
            const result = await startTracking('claim', selectedRoute);
            if (result?.ok) {
                navigation.navigate('ActiveRun');
            } else {
                setStartError(result?.message || 'Could not start the run. Check location access and retry.');
            }
        } catch {
            setStartError('Could not start the run. Check location access and retry.');
        } finally {
            startingRef.current = false;
            setStarting(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft color="#fff" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Plan Your Conquest</Text>
            </View>

            <View style={styles.mapPlaceholder}>
                <VectorMap minimap={true} suggestedRoute={selectedRoute} />
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

            <View style={styles.routeHeader}>
                <Text style={styles.sectionTitle}>Suggested Loops</Text>
                {routeState === 'loading' && <ActivityIndicator color="#FFB800" />}
            </View>
            {!locationAvailable && <Text style={styles.statusText}>Waiting for a valid GPS fix. Allow location access and move outdoors.</Text>}
            {routeError ? <Text style={styles.errorText}>{routeError}</Text> : null}
            {routeState === 'error' && (
                <TouchableOpacity style={styles.retryBtn} onPress={() => setRetryIndex((index) => index + 1)}>
                    <Text style={styles.retryBtnText}>Retry route suggestions</Text>
                </TouchableOpacity>
            )}

            {suggestedRoutes.map(route => {
                const selected = selectedRoute?.id === route.id;
                return (
                <TouchableOpacity key={route.id} style={[styles.loopCard, selected && styles.loopCardSelected]}
                    onPress={() => setSelectedRoute(route)} accessibilityRole="button"
                    accessibilityState={{ selected }}>
                    <View style={styles.loopIconWrapper}>
                        <MapPin color="#FFB800" size={20} />
                    </View>
                    <View style={styles.loopInfo}>
                        <Text style={styles.loopName}>{route.name}</Text>
                        <Text style={styles.loopMeta}>{route.type} • {route.distance} km</Text>
                        <Text style={route.verified ? styles.verifiedText : styles.estimateText}>
                            {route.verified ? 'Walking directions' : 'Concept only · not road-verified'}
                        </Text>
                        {route.description ? <Text style={styles.routeDescription}>{route.description}</Text> : null}
                    </View>
                </TouchableOpacity>
                );
            })}

            {startError ? <Text style={styles.errorText}>{startError}</Text> : null}
            <TouchableOpacity style={[styles.startBtn, starting && styles.startBtnDisabled]} onPress={handleStartRun} disabled={starting}>
                {starting ? <ActivityIndicator color="#000" /> : <Text style={styles.startBtnText}>{currentRun?.isActive ? 'Resume Run' : ['pending', 'uploading'].includes(currentRun?.submissionStatus) ? 'Retry Upload' : 'Start Conquest'}</Text>}
            </TouchableOpacity>
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
    contentContainer: {
        paddingBottom: 36,
    },
    routeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    statusText: {
        color: '#bbb',
        marginBottom: 12,
        lineHeight: 20,
    },
    errorText: {
        color: '#ff7777',
        marginVertical: 10,
        lineHeight: 20,
    },
    retryBtn: {
        alignSelf: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFB800',
        marginBottom: 12,
    },
    retryBtnText: {
        color: '#FFB800',
        fontWeight: 'bold',
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
    loopCardSelected: {
        borderWidth: 1,
        borderColor: '#FFB800',
        backgroundColor: '#28200d',
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
    loopInfo: {
        flex: 1,
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
    verifiedText: {
        color: '#8bd5a1',
        fontSize: 11,
        marginTop: 6,
    },
    estimateText: {
        color: '#ffc857',
        fontSize: 11,
        marginTop: 6,
    },
    routeDescription: {
        color: '#aaa',
        fontSize: 11,
        marginTop: 4,
    },
    startBtn: {
        backgroundColor: '#FFB800',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    startBtnDisabled: {
        opacity: 0.65,
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
