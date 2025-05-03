import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Platform, Alert, StatusBar, SafeAreaView } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import * as Location from 'expo-location'; // We need location permission for Wi-Fi scanning on Android
import WifiManager from "react-native-wifi-reborn";

// This is the most important part - we need to configure the Stack.Screen options
export const unstable_settings = {
  // Ensure that reloading on this screen keeps a back button present
  initialRouteName: "NetworkListScreen",
};

// This makes this Screen hide the default header
export default function NetworkListScreen() {
    const [networks, setNetworks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        router.setParams({ headerShown: false });
        requestPermissionsAndScan();
    }, []);

    const requestPermissionsAndScan = async () => {
        try {
            setLoading(true);

            if (Platform.OS === 'android') {
                // For Android, we need location permission to scan Wi-Fi
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(
                        'Permission Required',
                        'Location permission is required to scan for Wi-Fi networks.',
                        [{ text: 'OK', onPress: () => router.back() }]
                    );
                    return;
                }
            }

            // Get Wi-Fi networks
            if (Platform.OS === 'android') {
                const wifiList = await Network.getNetworkStateAsync();
                if (wifiList) {
                    setNetworks([{
                        ssid: wifiList.ssid || 'Unknown Network',
                        strength: wifiList.strength || -1,
                        isConnected: true
                    }]);
                }
            } else {
                // For iOS, we can only get the currently connected network
                const wifiInfo = await Network.getNetworkStateAsync();
                if (wifiInfo && wifiInfo.type === Network.NetworkStateType.WIFI) {
                    setNetworks([{
                        ssid: wifiInfo.ssid || 'Current Network',
                        strength: -1,
                        isConnected: true
                    }]);
                }
            }
        } catch (error) {
            console.error('Error scanning networks:', error);
            Alert.alert(
                'Error',
                'Failed to scan for networks. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setLoading(false);
        }
    };

    const handleNetworkSelect = (network) => {
        // Navigate to the next screen with the selected network
        router.push({
            pathname: "/device/DeviceScreenBounded",
            params: { ssid: network.ssid }
        });
    };

    const renderNetworkItem = ({ item }) => {
        const signalStrength = item.strength >= 0 ? item.strength : null;
        let signalIcon = 'wifi';
        
        // Determine signal icon based on strength
        if (signalStrength !== null) {
            if (signalStrength >= -50) signalIcon = 'wifi';
            else if (signalStrength >= -70) signalIcon = 'wifi-outline';
            else signalIcon = 'wifi-weak';
        }

        return (
            <TouchableOpacity
                style={styles.networkItem}
                onPress={() => handleNetworkSelect(item)}
            >
                <View style={styles.networkInfo}>
                    <Ionicons name={signalIcon} size={24} color="#007AFF" />
                    <Text style={styles.networkName}>{item.ssid}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
            </TouchableOpacity>
        );
    };

    return (
        <>
            {/* This completely removes the default header */}
            <Stack.Screen options={{ headerShown: false }} />
            
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />
                
                {/* Custom header */}
                <View style={styles.header}>
                    <TouchableOpacity 
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color="black" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Available Networks</Text>
                </View>

                {loading ? (
                    <View style={styles.centerContent}>
                        <Text style={styles.loadingText}>Scanning for networks...</Text>
                    </View>
                ) : networks.length === 0 ? (
                    <View style={styles.centerContent}>
                        <Text style={styles.noNetworksText}>
                            {Platform.OS === 'ios' 
                                ? 'Wi-Fi scanning is not available on iOS'
                                : 'No networks found'}
                        </Text>
                        {Platform.OS === 'android' && (
                            <TouchableOpacity 
                                style={styles.refreshButton}
                                onPress={requestPermissionsAndScan}
                            >
                                <Text style={styles.refreshButtonText}>Refresh</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <>
                        <FlatList
                            data={networks}
                            renderItem={renderNetworkItem}
                            keyExtractor={(item) => item.ssid}
                            contentContainerStyle={styles.listContainer}
                        />
                        <TouchableOpacity 
                            style={styles.refreshButton}
                            onPress={requestPermissionsAndScan}
                        >
                            <Text style={styles.refreshButtonText}>Refresh</Text>
                        </TouchableOpacity>
                    </>
                )}
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 16,
    },
    listContainer: {
        paddingVertical: 10,
    },
    networkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: 'white',
        marginVertical: 1,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    networkInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    networkName: {
        fontSize: 16,
        marginLeft: 12,
        color: '#000',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    loadingText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
    },
    noNetworksText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
    },
    refreshButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginVertical: 20,
        marginHorizontal: 20,
    },
    refreshButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
});