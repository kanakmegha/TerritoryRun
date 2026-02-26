import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import VectorMap from '../../components/Map/VectorMap';

const MapTab = () => {
    return (
        <View style={styles.container}>
            <VectorMap />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    }
});

export default MapTab;
