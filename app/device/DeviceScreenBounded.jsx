import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, SafeAreaView } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function DeviceScreenBounded() {
  const { ssid, deviceId } = useLocalSearchParams();
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {

    // Simulate connection process
    const timer = setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);


      // Uncomment the line below to simulate an error instead
      // setErrorMessage('Failed to connect to the device. Please try again.');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleFinish = () => {
    // Navigate to the main device screen or dashboard
    router.replace('/(tabs)');
  };

  const handleRetry = () => {
    setIsConnecting(true);
    setErrorMessage(null);
    
    // Simulate another connection attempt
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
    }, 3000);
  };

  return (
    <>
      {/* This completely removes the default header */}
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Device Setup</Text>
        </View>

        <View style={styles.content}>
          {isConnecting ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.statusText}>Connecting to {ssid}...</Text>
              <Text style={styles.detailText}>This may take a moment</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.statusContainer}>
              <View style={styles.errorIcon}>
                <Ionicons name="alert-circle" size={60} color="#FF3B30" />
              </View>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity style={styles.button} onPress={handleRetry}>
                <Text style={styles.buttonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.statusContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={60} color="#34C759" />
              </View>
              <Text style={styles.successText}>Device Connected Successfully!</Text>
              <Text style={styles.detailText}>
                Your pet feeder is now connected to {ssid} and ready to use.
              </Text>
              <TouchableOpacity style={styles.button} onPress={handleFinish}>
                <Text style={styles.buttonText}>Finish Setup</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Device ID: {deviceId || 'Unknown'}
          </Text>
        </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  successText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 24,
    color: '#34C759',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    color: '#FF3B30',
    textAlign: 'center',
  },
  detailText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 10,
    marginTop: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#8E8E93',
  },
}); 