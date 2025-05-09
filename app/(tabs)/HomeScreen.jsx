import React, { useState, useEffect } from "react";
import { 
  View, Text, FlatList, TouchableOpacity, Modal, TextInput, StyleSheet, SafeAreaView, ScrollView, Alert 
} from "react-native";
import { useRouter } from "expo-router";
import { auth, db } from "../firebaseConfig";
import { collection, doc, onSnapshot, setDoc, } from "firebase/firestore";
import { Ionicons } from '@expo/vector-icons';
import mqttService from '../services/mqttService';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const router = useRouter();
  const [pets, setPets] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPet, setNewPet] = useState({ name: "", weight: "" });
  const [nextMeals, setNextMeals] = useState([]);
  const [storage, setStorage] = useState(85); // Initial value, will be updated by MQTT
  const [temperature, setTemperature] = useState(null); // Will be updated with real temperature
  const [isConnected, setIsConnected] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [gpsData, setGpsData] = useState(null);


  const userId = auth.currentUser?.uid;
  let percantageStorage = storage * 100;
  // Function to get current location
  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission to access location was denied');
        return null;
      }
      let location = await Location.getCurrentPositionAsync({});
      return location.coords;
    } catch (error) {
      setLocationError('Error getting location: ' + error.message);
      return null;
    }
  };

  // Function to fetch temperature from Weatherstack
  const getTemperatureFromWeatherstack = async (lat, lon) => {
    try {
      const accessKey = 'c602a922ae89ce4a642a8be9b4f0f628'; // Replace with your actual API key
      const url = `http://api.weatherstack.com/current?access_key=${accessKey}&query=${lat},${lon}&units=m`;
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(data);
      if (data && data.current && typeof data.current.temperature === 'number') {
        return data.current.temperature;
      }
      throw new Error('Could not fetch temperature');
    } catch (error) {
      console.error('Weather API Error:', error);
      setLocationError('Failed to fetch temperature: ' + error.message);
      return null;
    }
  };

  // Function to update temperature
  const updateTemperature = async () => {
    const coords = await getLocation();
    if (coords) {
      const temp = await getTemperatureFromWeatherstack(coords.latitude, coords.longitude);
      if (temp !== null) {
        setTemperature(temp);
      }
    }
  };

  // Update temperature every 5 minutes
  useEffect(() => {
    updateTemperature();
    const interval = setInterval(updateTemperature, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Listen to pets collection
    const petsRef = collection(db, "users", userId, "pets");
    const unsubscribePets = onSnapshot(petsRef, async (snapshot) => {
      const petList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPets(petList);

      // Set up listeners for meals of each pet
      const mealListeners = petList.map(pet => {
        const mealsRef = collection(db, "users", userId, "pets", pet.id, "meals");
        return onSnapshot(mealsRef, (mealsSnapshot) => {
          const meals = mealsSnapshot.docs.map(mealDoc => ({
            id: mealDoc.id,
            petId: pet.id,
            petName: pet.name,
            ...mealDoc.data(),
          }));

          // Update nextMeals state with the new meals
          setNextMeals(prevMeals => {
            // Remove old meals for this pet
            const otherPetsMeals = prevMeals.filter(meal => meal.petId !== pet.id);
            // Add new meals for this pet
            return [...otherPetsMeals, ...meals].sort((a, b) => {
              // Sort by time
              return a.alarm.localeCompare(b.alarm);
            });
          });
        });
      });

      // Cleanup function to unsubscribe from all meal listeners
      return () => {
        mealListeners.forEach(unsubscribe => unsubscribe());
      };
    });

    // Cleanup function to unsubscribe from pets listener
    return () => {
      unsubscribePets();
    };
  }, [userId]);

  useEffect(() => {
    // Connect to MQTT when component mounts
    connectMQTT();

    // Cleanup on unmount
    return () => {
      mqttService.disconnect();
    };
  }, []);

  const connectMQTT = async () => {
    try {
      await mqttService.connect();
      setIsConnected(true);

      // Set up listeners for storage and temperature
      mqttService.addTopicListener("/device/storage", (data) => {
        if (data.storage !== undefined) {
          setStorage(data.storage);
        }
      });


      // Subscribe to weight topic
      mqttService.addTopicListener("/device/weight/10kg", (message) => {
        console.log("Received weight data:", message);
        if (message && typeof message === 'object' && message.weight !== undefined) {
          setStorage(message.weight);
        }
      });
      mqttService.addTopicListener("/device/gps", (message) => {
        console.log("Received gps data:", message);
      });


    } catch (error) {
      console.error("Failed to connect to MQTT:", error);
      Alert.alert(
        "Connection Error",
        "Failed to connect to the device. Please check your network connection and try again."
      );
    }
  };

  // Function to trigger immediate feeding
  const handleFeedNow = (amount) => {
    if (!isConnected) {
      Alert.alert("Not Connected", "Please wait for device connection");
      return;
    }
    
    mqttService.feedNow(amount);
  };

  // Function to update feeding schedule
  const handleUpdateSchedule = (scheduleData) => {
    if (!isConnected) {
      Alert.alert("Not Connected", "Please wait for device connection");
      return;
    }

    mqttService.updateSchedule(scheduleData);
  };

  const handleAddPet = async () => {
    if (!userId || !newPet.name || !newPet.weight) return;

    try {
      const petRef = doc(collection(db, "users", userId, "pets"));
      await setDoc(petRef, {
        name: newPet.name,
        weight: newPet.weight,
        createdAt: new Date().toISOString(),
      });

      setModalVisible(false);
      setNewPet({ name: "", weight: "" });
    } catch (error) {
      console.error("Error adding pet:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace("/sign-in");
    } catch (error) {
      console.error("Logout Error:", error.message);
    }
  };

  const renderMealCard = ({ item }) => (
    <TouchableOpacity 
      style={[styles.mealCard, !item.active && styles.mealCardInactive]}
      onPress={() => router.push(`/petDetails/${item.petId}`)}
    >
      <View style={styles.mealCardContent}>
        <View style={styles.mealCardLeft}>
          <Text style={styles.mealPetName}>{item.petName}</Text>
          <View style={styles.mealDetails}>
            <Text style={styles.mealPortion}>{item.portion}GR</Text>
            <Text style={styles.mealTime}>{item.alarm}</Text>
          </View>
        </View>
        <View style={styles.alarmStatus}>
          <Ionicons 
            name={item.active ? "alarm" : "alarm-outline"} 
            size={24} 
            color={item.active ? "#8B5E3C" : "#A89481"} 
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Add connection status indicator */}
      <View style={styles.statusIndicator}>
        <View style={[
          styles.connectionDot,
          { backgroundColor: isConnected ? '#4CAF50' : '#FF3B30' }
        ]} />
        <Text style={styles.connectionText}>
          {isConnected ? 'Connected' : 'Disconnecting...'}
        </Text>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pet Feeder</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.headerIcon}>
          <Ionicons name="log-out-outline" size={24} color="#6D4C41" />
        </TouchableOpacity>
      </View>
      
      {/* Status Cards */}
      <View style={styles.statusRow}>
        <View style={styles.statusCard}>
          <Ionicons name="cube-outline" size={24} color="#8B5E3C" />
          <Text style={styles.statusText}>{percantageStorage}%</Text>
          <Text style={styles.statusLabel}>Food Level</Text>
        </View>
        <View style={styles.statusCard}>
          <Ionicons name="thermometer-outline" size={24} color="#8B5E3C" />
          <Text style={styles.statusText}>
            {temperature !== null ? `${temperature}°C` : "25°C"}
          </Text>
          <Text style={styles.statusLabel}>Temperature</Text>
{/*           {locationError && (
            <Text style={styles.errorText}>{locationError}</Text>
          )}
 */}        </View>
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming Meals</Text>
      </View>

      {/* Meals List */}
      <FlatList
        data={nextMeals}
        keyExtractor={(item) => `${item.petId}-${item.id}`}
        renderItem={renderMealCard}
        style={styles.mealsList}
        contentContainerStyle={styles.mealsListContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No scheduled meals yet</Text>
          </View>
        }
      />

      {/* Bottom Navigation with Pets and Logout */}
      <View style={styles.bottomNav}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {pets.map((pet) => (
            <TouchableOpacity
              key={pet.id}
              style={styles.petButton}
              onPress={() => router.push(`/petDetails/${pet.id}`)}
            >
              <Text style={styles.petButtonText}>{pet.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.petButton, styles.addPetButton]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Add Pet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Pet</Text>
            <TextInput
              style={styles.input}
              placeholder="Pet Name"
              value={newPet.name}
              onChangeText={(text) => setNewPet({ ...newPet, name: text })}
              placeholderTextColor="#A89481"
            />
            <TextInput
              style={styles.input}
              placeholder="Weight (gr)"
              value={newPet.weight}
              onChangeText={(text) => setNewPet({ ...newPet, weight: text })}
              keyboardType="numeric"
              placeholderTextColor="#A89481"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.addButton]}
                onPress={handleAddPet}
              >
                <Text style={styles.buttonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E8C7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    backgroundColor: '#F5E8C7',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(109, 76, 65, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6D4C41',
  },
  headerIcon: {
    padding: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: '#FAF3E0',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6D4C41',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5A3E1B',
    marginTop: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#8B5E3C',
    marginTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6D4C41',
  },
  mealsList: {
    flex: 1,
  },
  mealsListContent: {
    padding: 16,
    paddingTop: 8,
  },
  mealCard: {
    backgroundColor: '#FAF3E0',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#6D4C41',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mealCardInactive: {
    opacity: 0.6,
  },
  mealCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealCardLeft: {
    flex: 1,
  },
  mealPetName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: '#5A3E1B',
  },
  mealDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  mealPortion: {
    fontSize: 14,
    color: '#8B5E3C',
    fontWeight: '500',
  },
  mealTime: {
    fontSize: 14,
    color: '#8B5E3C',
  },
  alarmStatus: {
    marginLeft: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8B5E3C',
    textAlign: 'center',
  },
  bottomNav: {
    backgroundColor: '#F9F6F2',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(109, 76, 65, 0.1)',
  },
  petButton: {
    backgroundColor: '#8B5E3C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6D4C41',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  petButtonText: {
    color: '#F9F6F2',
    fontWeight: '600',
    fontSize: 16,
  },
  addPetButton: {
    backgroundColor: '#6D4C41',
    minWidth: 50,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#F9F6F2',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#6D4C41',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(109, 76, 65, 0.2)',
    backgroundColor: '#FAF3E0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#5A3E1B',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#A89481',
  },
  addButton: {
    backgroundColor: '#8B5E3C',
  },
  buttonText: {
    color: '#F9F6F2',
    fontSize: 16,
    fontWeight: '600',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    color: '#6D4C41',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
});
