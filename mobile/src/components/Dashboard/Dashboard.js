import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useGameStore } from '../../hooks/useGameStore';
import StatsCard from './StatsCard';
import { Trophy, Map as MapIcon, Activity, AlertTriangle, Lock, Unlock } from 'lucide-react-native';

const Dashboard = () => {
  const { 
    user, alerts, logout,
    startContinuousRun,
    currentRun, addAlert,
    isCameraLocked, setCameraLocked,
  } = useGameStore();
  
  if (!user || !user.stats) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#00f3ff" style={{ marginBottom: 20 }} />
        <Text style={styles.loadingText}>INITIALIZING PROTOCOL...</Text>
      </View>
    );
  }

  const handleReclaim = () => {
      try {
        addAlert("⚔️ Reclaim activated! GPS tracking starting...");
        startContinuousRun(); 
        // Note: Map auto-centering is handled in InvasionSimulator.js using lostTiles
      } catch (err) {
        console.error("Reclaim error:", err);
      }
  };

  const territories = user.stats?.territories || 0;
  const rankValue = territories > 0 
    ? `#${Math.floor(1000 / (territories + 1))}` 
    : "N/A";

  const formatDistanceValue = (meters) => {
    if (meters < 50) return `${(meters * 100).toFixed(0)} cm`;
    if (meters < 500) return `${meters.toFixed(1)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  return (
    <View pointerEvents="box-none" style={styles.dashboardContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>TERRITORY RUN</Text>
        <View style={styles.userProfile}>
            <TouchableOpacity 
              style={[styles.cameraToggle, isCameraLocked && styles.cameraToggleLocked]}
              onPress={() => setCameraLocked(!isCameraLocked)}
            >
              {isCameraLocked ? <Lock size={16} color="#00f3ff" /> : <Unlock size={16} color="#00f3ff" />}
            </TouchableOpacity>
            <View style={[styles.avatar, { backgroundColor: user.color || '#00f3ff' }]} />
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name || user.username || "Agent"}</Text>
                <TouchableOpacity onPress={logout}>
                    <Text style={styles.logoutBtn}>LOGOUT</Text>
                </TouchableOpacity>
            </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatsCard label="Rank" value={rankValue} icon={Trophy} />
        <StatsCard label="Territories" value={territories} icon={MapIcon} />
        <StatsCard label="Distance" value={formatDistanceValue(territories * 1)} icon={Activity} />
      </View>

      {/* FAB (Only if not running) */}
      {!currentRun.isActive && (
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.fabBtn} onPress={startContinuousRun}>
            <Text style={styles.fabText}>🏃 RUN PROTOCOL</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Simulation/Alerts Area */}
      <View style={styles.bottomArea} pointerEvents="box-none">
        <View style={styles.defendList}>
            <View style={styles.defendHeader}>
                <AlertTriangle size={16} color="#ff00ff" />
                <Text style={styles.defendTitle}>DEFEND ALERTS</Text>
            </View>
            
            <ScrollView style={styles.alertsScroll} nestedScrollEnabled={true}>
                {alerts && alerts.length === 0 ? (
                    <Text style={styles.emptyAlert}>No active threats</Text>
                ) : (
                    alerts.map((alert, index) => (
                        <View key={`alert-${alert.id}-${index}`} style={styles.alertItem}>
                            <Text style={styles.alertTime}>{alert.time}</Text>
                            <Text style={styles.alertMsg}>{alert.message}</Text>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingText: {
    color: '#00f3ff',
    fontSize: 14,
    letterSpacing: 2,
  },
  dashboardContainer: {
    ...StyleSheet.absoluteFillObject,
    padding: 15,
    paddingTop: 50, // safe area approx
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#00f3ff',
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 2,
    textShadowColor: '#00f3ff',
    textShadowRadius: 10,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00f3ff',
    gap: 8,
  },
  cameraToggle: {
    padding: 5,
  },
  cameraToggleLocked: {
    opacity: 0.8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fff',
  },
  userInfo: {
    flexDirection: 'column',
  },
  userName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutBtn: {
    color: '#ff3333',
    fontSize: 10,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  bottomArea: {
    flex: 1,
    justifyContent: 'flex-end',
    marginBottom: 90, // Leave room for LiveRunCard or bottom edge
  },
  defendList: {
    backgroundColor: 'rgba(20, 0, 0, 0.8)',
    borderColor: '#ff00ff',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    maxHeight: 250,
  },
  defendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  defendTitle: {
    color: '#ff00ff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  alertsScroll: {
    maxHeight: 80,
    marginBottom: 10,
  },
  emptyAlert: {
    color: '#888',
    fontStyle: 'italic',
    fontSize: 12,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  alertTime: {
    color: '#888',
    fontSize: 10,
    width: 60,
  },
  alertMsg: {
    color: '#00f3ff',
    fontSize: 11,
    flex: 1,
  },
  simBtn: {
    backgroundColor: 'rgba(255, 0, 85, 0.2)',
    borderColor: '#ff00ff',
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 4,
    marginBottom: 8,
  },
  simBtnText: {
    color: '#ff00ff',
    fontWeight: 'bold',
  },
  reclaimBtn: {
    backgroundColor: '#00f3ff',
    padding: 15,
    alignItems: 'center',
    borderRadius: 4,
    marginBottom: 8,
  },
  reclaimBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  debugBtn: {
    backgroundColor: 'rgba(0, 255, 234, 0.1)',
    borderColor: '#00f3ff',
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    borderRadius: 4,
  },
  debugBtnText: {
    color: '#00f3ff',
    fontSize: 10,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
  fabBtn: {
    backgroundColor: '#00f3ff',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#00f3ff',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  fabText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  subtitleOverlay: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderColor: '#ff00ff',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subtitlePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff00ff',
  },
  subtitleText: {
    color: '#ff00ff',
    fontWeight: 'bold',
  },
  missionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  missionContent: {
    backgroundColor: '#1a0000',
    borderColor: '#ff00ff',
    borderWidth: 2,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: '80%',
  },
  missionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  missionTitle: {
    color: '#ff00ff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  missionDesc: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  missionBtn: {
    borderColor: '#ff00ff',
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  missionBtnText: {
    color: '#ff00ff',
  }
});

export default Dashboard;
