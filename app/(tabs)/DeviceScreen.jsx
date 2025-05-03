import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function DeviceScreen() {
    const router = useRouter();
    
    return (
        <SafeAreaView style={styles.container}>
            {/* Top Section */}
            <View style={styles.topSection}>
                <View style={styles.header}>
                    <Text style={styles.title}>Connect Device</Text>
                </View>
            </View>

            {/* Middle Section with Icon and Description */}
            <View style={styles.middleSection}>
                <View style={styles.iconContainer}>
                    <View style={styles.iconBackground}>
                        <Ionicons name="hardware-chip-outline" size={80} color="#8B5E3C" />
                    </View>
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.mainText}>Get Started with Your Device</Text>
                    <Text style={styles.descriptionText}>
                        Connect your pet feeder by scanning the QR code located on the device
                    </Text>
                </View>
            </View>

            {/* Bottom Section with Button */}
            <View style={styles.bottomSection}>
                <TouchableOpacity 
                    style={styles.getStartedButton}
                    onPress={() => router.push('/device/QrReadingScreen')}
                >
                    <View style={styles.buttonContent}>
                        <Ionicons name="qr-code-outline" size={24} color="#FAF3E0" />
                        <Text style={styles.buttonText}>SCAN QR CODE</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.helpContainer}>
                    <Text style={styles.helpText}>
                        Need help finding the QR code?{' '}
                        <Text style={styles.helpLink}>View guide</Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5E8C7', // Warm beige background
    },
    topSection: {
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#6D4C41', // Earthy brown
        letterSpacing: 0.5,
    },
    middleSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    iconContainer: {
        marginBottom: 48,
    },
    iconBackground: {
        width: 180,
        height: 180,
        backgroundColor: '#FAF3E0', // Light cream background
        borderRadius: 90,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6D4C41',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(139, 94, 60, 0.1)', // Subtle border
    },
    textContainer: {
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    mainText: {
        fontSize: 26,
        fontWeight: '700',
        color: '#5A3E1B', // Dark brown
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: 0.5,
    },
    descriptionText: {
        fontSize: 17,
        color: '#8B5E3C', // Deep wood brown
        textAlign: 'center',
        lineHeight: 26,
        opacity: 0.9,
    },
    bottomSection: {
        padding: 24,
        paddingBottom: 40,
    },
    getStartedButton: {
        backgroundColor: '#8B5E3C', // Deep wood brown
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#6D4C41',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(139, 94, 60, 0.2)', // Subtle border
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
    },
    buttonText: {
        color: '#FAF3E0', // Light cream
        fontSize: 17,
        fontWeight: '700',
        marginLeft: 12,
        letterSpacing: 1,
    },
    helpContainer: {
        marginTop: 20,
        padding: 8,
    },
    helpText: {
        textAlign: 'center',
        color: '#8B5E3C', // Deep wood brown
        fontSize: 15,
        opacity: 0.9,
    },
    helpLink: {
        color: '#6D4C41', // Earthy brown
        textDecorationLine: 'underline',
        fontWeight: '600',
    },
});