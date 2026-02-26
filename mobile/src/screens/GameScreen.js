import React from 'react';
import { StyleSheet, View } from 'react-native';
import Dashboard from '../components/Dashboard/Dashboard';
import LiveRunCard from '../components/Dashboard/LiveRunCard';
import VectorMap from '../components/Map/VectorMap';

export default function GameScreen() {
    return (
        <View style={styles.container}>
            <VectorMap />
            <Dashboard />
            <LiveRunCard />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    }
});
