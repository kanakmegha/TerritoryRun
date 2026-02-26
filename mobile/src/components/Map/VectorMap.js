import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline, Polygon } from 'react-native-maps';
import { useGameStore } from '../../hooks/useGameStore';
import * as Location from 'expo-location';

const VectorMap = React.memo(({ minimap = false }) => {
    const { 
        lastPosition, isCameraLocked,
        territories, currentRun, activeGameMode,
        gpsStatus, gpsError, startGpsTracking,
        isOffRoad
    } = useGameStore();

    const mapRef = useRef(null);
    const prevPosRef = useRef(null);
    const [mapReady, setMapReady] = useState(false);
    const [layoutReady, setLayoutReady] = useState(false);
    const [hasAnimatedInitial, setHasAnimatedInitial] = useState(false);

    const initialRegion = {
        latitude: (lastPosition?.lat && !isNaN(lastPosition.lat)) ? lastPosition.lat : 37.7749,
        longitude: (lastPosition?.lng && !isNaN(lastPosition.lng)) ? lastPosition.lng : -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    };

    // Force re-center if camera is locked and position changes
    useEffect(() => {
        if (isCameraLocked && lastPosition && lastPosition.lat && mapRef.current && mapReady && layoutReady) {
            
            // Avoid unnecessary animation if movement is tiny (< 2m)
            if (prevPosRef.current) {
                const latDiff = Math.abs(prevPosRef.current.lat - lastPosition.lat);
                const lngDiff = Math.abs(prevPosRef.current.lng - lastPosition.lng);
                // Approx 2m in degrees
                if (latDiff < 0.00002 && lngDiff < 0.00002 && hasAnimatedInitial) return;
            }

            const runAnimation = () => {
                if (!mapRef.current) return;
                try {
                    mapRef.current.animateToRegion({
                        latitude: Number(lastPosition.lat),
                        longitude: Number(lastPosition.lng),
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                    }, 1000);
                    if (!hasAnimatedInitial) setHasAnimatedInitial(true);
                    prevPosRef.current = lastPosition;
                } catch (e) {
                    console.warn("[VectorMap] Animation error:", e.message);
                }
            };

            if (!hasAnimatedInitial) {
                const timer = setTimeout(runAnimation, 1000);
                return () => clearTimeout(timer);
            } else {
                runAnimation();
            }
        }
    }, [lastPosition, isCameraLocked, mapReady, layoutReady]);

    const handleRequestPermissions = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
            startGpsTracking();
        }
    };

    const customMapStyle = [
      {
        "elementType": "geometry",
        "stylers": [{ "color": "#212121" }]
      },
      {
        "elementType": "labels.icon",
        "stylers": [{ "visibility": "off" }]
      },
      {
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#757575" }]
      },
      {
        "elementType": "labels.text.stroke",
        "stylers": [{ "color": "#212121" }]
      },
      {
        "featureType": "administrative",
        "elementType": "geometry",
        "stylers": [{ "color": "#757575" }]
      },
      {
        "featureType": "road",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#2c2c2c" }]
      },
      {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [{ "color": "#000000" }]
      }
    ];

    const isSpeedExceeded = currentRun.isActive && currentRun.pace > 0 && (60 / currentRun.pace) > 15;

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={initialRegion}
                customMapStyle={customMapStyle}
                showsUserLocation={true}
                onMapReady={() => setMapReady(true)}
                onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    if (width > 0 && height > 0) setLayoutReady(true);
                }}
            >
                {/* Render captured loops / territories */}
                {territories.map((t) => {
                    if (!t.boundary || !t.boundary.coordinates) return null;
                    const ring = t.boundary.coordinates[0];
                    if (!ring || ring.length < 3) return null;
                    
                    const coords = ring.map(c => ({
                        latitude: c[1],
                        longitude: c[0]
                    }));

                    // Safety: Only append alpha if it looks like a hex color
                    const baseColor = (t.ownerColor && t.ownerColor.startsWith('#')) ? t.ownerColor : '#00f3ff';
                    const glowColor = baseColor + '33';
                    const fillColor = baseColor + '44';
                    
                    // Note: Avoiding React.Fragment as it can break some MapView implementations on Android
                    return (
                        <Polygon
                            key={`${t._id}_main`}
                            coordinates={coords}
                            fillColor={fillColor}
                            strokeColor={baseColor}
                            strokeWidth={2}
                        />
                    );
                })}

                {/* Render active run path */}
                {currentRun?.path?.length > 1 && (
                    <Polyline
                        coordinates={currentRun.path
                            .map(p => {
                                const lat = Array.isArray(p) ? p[0] : (p.lat || p.latitude);
                                const lng = Array.isArray(p) ? p[1] : (p.lng || p.longitude);
                                if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) return null;
                                return { latitude: lat, longitude: lng };
                            })
                            .filter(Boolean)
                        }
                        strokeColor={isSpeedExceeded ? "#ff4444" : "#00ffea"}
                        strokeWidth={4}
                    />
                )}

                {/* Manual Player Marker if GPS isn't showing blue dot or for better visibility */}
                {lastPosition && lastPosition.lat && (
                    <Marker
                        key="player_marker"
                        coordinate={{
                            latitude: lastPosition.lat,
                            longitude: lastPosition.lng
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                        flat={true}
                    >
                        <View style={[styles.playerMarker, isSpeedExceeded && { backgroundColor: '#ff4444', borderColor: '#fff' }]} />
                    </Marker>
                )}
            </MapView>

            {/* Mount Verification Overlay */}
            <View style={styles.mountVerify}>
                <Text style={styles.mountVerifyText}>MAP ENGINE ACTIVE</Text>
            </View>

            {/* Off-Road Warning */}
            {isOffRoad && currentRun?.isActive && (
                <View style={styles.offRoadOverlay}>
                    <Text style={styles.offRoadIcon}>🚫</Text>
                    <Text style={styles.offRoadTitle}>OFF-ROAD</Text>
                    <Text style={styles.offRoadSubtext}>Return to a road to capture distance</Text>
                </View>
            )}

            {/* Speed Warning Overlay */}
            {isSpeedExceeded && (
                <View style={styles.warningOverlay}>
                    <Text style={styles.warningText}>⚠️ SPEED LIMIT EXCEEDED</Text>
                    <Text style={styles.warningSubtext}>Distance capture paused.</Text>
                </View>
            )}

            {/* Debug HUD - Only show if not a minimap */}
            {!minimap && (
                <View style={styles.debugHud}>
                    <Text style={styles.debugText}>GPS: {gpsStatus}</Text>
                    {gpsError && <Text style={[styles.debugText, {color: '#ff4444'}]}>{gpsError}</Text>}
                    <Text style={styles.debugText}>Lat: {lastPosition?.lat?.toFixed(5) || '?'}</Text>
                    <Text style={styles.debugText}>Lng: {lastPosition?.lng?.toFixed(5) || '?'}</Text>
                    <Text style={styles.debugText}>Territories: {territories.length}</Text>
                    
                    {gpsStatus === 'error' && (
                        <TouchableOpacity style={styles.retryBtn} onPress={handleRequestPermissions}>
                            <Text style={styles.retryText}>Grant Permission</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    playerMarker: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#00ffea',
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#00ffea',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
    },
    debugHud: {
        position: 'absolute',
        top: 40,
        right: 15,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 10,
        borderRadius: 8,
        borderColor: '#00f3ff',
        borderWidth: 1,
    },
    debugText: {
        color: '#00f3ff',
        fontSize: 10,
        fontWeight: 'bold',
        fontFamily: 'monospace',
    },
    retryBtn: {
        marginTop: 5,
        backgroundColor: '#00f3ff',
        padding: 5,
        borderRadius: 4,
        alignItems: 'center',
    },
    retryText: {
        color: '#000',
        fontSize: 10,
        fontWeight: 'bold',
    },
    warningOverlay: {
        position: 'absolute',
        top: '20%',
        alignSelf: 'center',
        backgroundColor: 'rgba(255, 68, 68, 0.9)',
        padding: 20,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#fff',
        alignItems: 'center',
    },
    warningText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    warningSubtext: {
        color: '#fff',
        fontSize: 12,
        marginTop: 5,
    },
    mountVerify: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        backgroundColor: 'rgba(0,255,0,0.2)',
        padding: 4,
        borderRadius: 4,
    },
    mountVerifyText: {
        color: '#0f0',
        fontSize: 8,
        fontWeight: 'bold',
    },
    offRoadOverlay: {
        position: 'absolute',
        top: '30%',
        alignSelf: 'center',
        backgroundColor: 'rgba(180, 0, 0, 0.92)',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#ff6666',
        alignItems: 'center',
        shadowColor: '#ff0000',
        shadowOpacity: 0.8,
        shadowRadius: 12,
        elevation: 10,
    },
    offRoadIcon: {
        fontSize: 28,
        marginBottom: 4,
    },
    offRoadTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 3,
    },
    offRoadSubtext: {
        color: '#ffcccc',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
});

export default VectorMap;
