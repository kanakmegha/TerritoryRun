import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Target, Map as MapIcon, Shield, Trophy, Users } from 'lucide-react-native';

import MissionTab from './tabs/MissionTab';
import MapTab from './tabs/MapTab';
import EmpireTab from './tabs/EmpireTab';
import LeaderboardTab from './tabs/LeaderboardTab';
import TeamsTab from './tabs/TeamsTab';

const Tab = createBottomTabNavigator();

const CommandCenter = () => {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#111111',
                    borderTopColor: '#333',
                    height: 60,
                    paddingBottom: 10,
                    paddingTop: 10,
                },
                tabBarActiveTintColor: '#FFB800',
                tabBarInactiveTintColor: '#888',
            }}
        >
            <Tab.Screen 
                name="Mission" 
                component={MissionTab} 
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <Target color={color} size={size} />
                    )
                }}
            />
            <Tab.Screen 
                name="Map" 
                component={MapTab} 
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MapIcon color={color} size={size} />
                    )
                }}
            />
            <Tab.Screen 
                name="Empire" 
                component={EmpireTab} 
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <Shield color={color} size={size} />
                    )
                }}
            />
            <Tab.Screen 
                name="Leaderboard" 
                component={LeaderboardTab} 
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <Trophy color={color} size={size} />
                    )
                }}
            />
            <Tab.Screen 
                name="Teams" 
                component={TeamsTab} 
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <Users color={color} size={size} />
                    )
                }}
            />
        </Tab.Navigator>
    );
};

export default CommandCenter;

