// /app/petDetails/[id].js
import React, { useEffect, useState } from "react";
import { View, Text, Button, TextInput, Image, StyleSheet, Modal, Switch, ScrollView, TouchableOpacity, Platform, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db } from "../firebaseConfig"; // Adjust path as needed
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import mqttService from '../services/mqttService';

export default function PetDetailsScreen() {
  const { id } = useLocalSearchParams(); // Get the petId from the URL params
  const [pet, setPet] = useState(null);
  const [meals, setMeals] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newMeal, setNewMeal] = useState({
    portion: "",
    alarm: new Date(),
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [uploading, setUploading] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);

  const userId = auth.currentUser?.uid;
  const storage = getStorage();

  // Request permission for image picker
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Sorry, we need camera roll permissions to make this work!');
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId || !id) return;

    // Fetch pet details
    const fetchPet = async () => {
      const petRef = doc(db, "users", userId, "pets", id);
      const petDoc = await getDoc(petRef);
      if (petDoc.exists()) {
        setPet(petDoc.data());
      }
    };

    fetchPet();

    // Subscribe to meals updates
    const mealsRef = collection(db, "users", userId, "pets", id, "meals");
    const unsubscribe = onSnapshot(mealsRef, (snapshot) => {
      const mealsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMeals(mealsList.sort((a, b) => a.alarm.localeCompare(b.alarm)));
    });

    return () => unsubscribe();
  }, [userId, id]);

  const handleAddMeal = async () => {
    if (!userId || !id || !newMeal.portion) return;

    try {
      const mealsRef = collection(db, "users", userId, "pets", id, "meals");
      const newMealData = {
        portion: newMeal.portion,
        alarm: newMeal.alarm.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        }),
        active: true,
      };

      await addDoc(mealsRef, newMealData);

      // Send to MQTT
      mqttService.publishMessage("/device/schedule/add", {
        time: newMealData.alarm,
        portion: parseInt(newMealData.portion),
        enabled: true
      });

      setModalVisible(false);
      setNewMeal({ portion: "", alarm: new Date() });
    } catch (error) {
      console.error("Error adding meal:", error);
      Alert.alert("Error", "Failed to add meal schedule");
    }
  };

  const toggleMealStatus = async (mealId, currentStatus, mealData) => {
    try {
      const mealRef = doc(db, "users", userId, "pets", id, "meals", mealId);
      const newStatus = !currentStatus;
      
      await updateDoc(mealRef, {
        active: newStatus,
      });

      // Send to MQTT
      mqttService.publishMessage("/device/schedule/toggle", {
        time: mealData.alarm,
        enabled: newStatus,
        portion: parseInt(mealData.portion)
      });

    } catch (error) {
      console.error("Error toggling meal status:", error);
      Alert.alert("Error", "Failed to update meal status");
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setNewMeal({ ...newMeal, alarm: selectedTime });
    }
  };

  const handleDeleteMeal = (mealId, mealData) => {
    Alert.alert(
      "Delete Meal",
      "Are you sure you want to delete this meal?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!userId || !id || !mealId) return;

            try {
              const mealRef = doc(db, `users/${userId}/pets/${id}/meals/${mealId}`);
              await deleteDoc(mealRef);

              // Send to MQTT
              mqttService.publishMessage("/device/schedule/delete", {
                time: mealData.alarm
              });

            } catch (error) {
              console.error("Error deleting meal:", error);
              Alert.alert("Error", "Failed to delete meal");
            }
          }
        }
      ]
    );
  };

  const handleUpdateWeight = async () => {
    if (!newWeight) return;
    
    try {
      const petRef = doc(db, "users", userId, "pets", id);
      await updateDoc(petRef, {
        weight: newWeight
      });
      setPet(prev => ({ ...prev, weight: newWeight }));
      setIsEditingWeight(false);
      setNewWeight("");
    } catch (error) {
      console.error("Error updating weight:", error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3, // Reduced quality to keep base64 string smaller
        base64: true, // Enable base64 encoding
      });

      if (!result.canceled) {
        await saveImageToFirestore(result.assets[0].base64);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const saveImageToFirestore = async (base64Image) => {
    if (!base64Image || !userId || !id) return;

    // Check image size (approximate base64 size)
    const sizeInBytes = base64Image.length * 0.75; // base64 is ~33% larger than binary
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    if (sizeInMB > 0.7) { // Leave some room for other data in the document
      Alert.alert(
        "Error", 
        "Image is too large. Please choose a smaller image or try again with lower quality."
      );
      return;
    }

    setUploading(true);
    try {
      // Update pet document with base64 image
      const petRef = doc(db, "users", userId, "pets", id);
      await updateDoc(petRef, {
        photoBase64: `data:image/jpeg;base64,${base64Image}`,
        lastPhotoUpdate: new Date().toISOString()
      });

      // Update local state
      setPet(prev => ({ 
        ...prev, 
        photoBase64: `data:image/jpeg;base64,${base64Image}`,
        lastPhotoUpdate: new Date().toISOString()
      }));
      
      Alert.alert("Success", "Photo saved successfully!");
    } catch (error) {
      console.error("Error saving image:", error);
      Alert.alert(
        "Error", 
        "Failed to save image. Please try again with a smaller image."
      );
    } finally {
      setUploading(false);
    }
  };

  // Send full schedule when meals change
  useEffect(() => {
    if (meals.length > 0) {
      const activeSchedule = meals
        .filter(meal => meal.active)
        .map(meal => ({
          time: meal.alarm,
          portion: parseInt(meal.portion),
          enabled: meal.active
        }));

      mqttService.publishMessage("/device/schedule", {
        schedule: activeSchedule
      });
    }
  }, [meals]);

  useEffect(() => {
    const checkConnection = () => {
      setMqttConnected(mqttService.isConnected);
    };

    // Check initial connection
    checkConnection();

    // Set up interval to check connection status
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: "",
          headerTransparent: true,
          headerBackVisible: true,
          headerTintColor: "#6D4C41",
        }} 
      />
      <ScrollView style={styles.container}>
        {pet && (
          <>
            {/* Photo Section */}
            <View style={styles.photoContainer}>
              {uploading ? (
                <View style={[styles.photoPlaceholder, styles.uploadingContainer]}>
                  <ActivityIndicator size="large" color="#8B5E3C" />
                  <Text style={styles.uploadingText}>Saving photo...</Text>
                </View>
              ) : pet.photoBase64 ? (
                <Image 
                  source={{ uri: pet.photoBase64 }} 
                  style={styles.petPhoto}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="paw-outline" size={50} color="#8B5E3C" />
                </View>
              )}
              <TouchableOpacity 
                style={[
                  styles.changePhotoButton,
                  uploading && styles.changePhotoButtonDisabled
                ]}
                onPress={pickImage}
                disabled={uploading}
              >
                <Text style={styles.changePhotoText}>
                  {uploading ? "Saving..." : "Change Photo"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.petName}>{pet.name}</Text>
            
            {/* Weight Section */}
            <View style={styles.weightContainer}>
              {isEditingWeight ? (
                <View style={styles.weightEditContainer}>
                  <TextInput
                    style={styles.weightInput}
                    value={newWeight}
                    onChangeText={setNewWeight}
                    placeholder={`Current: ${pet.weight}gr`}
                    keyboardType="numeric"
                    placeholderTextColor="#A89481"
                  />
                  <TouchableOpacity 
                    style={styles.weightSaveButton}
                    onPress={handleUpdateWeight}
                  >
                    <Text style={styles.weightSaveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.weightDisplay}
                  onPress={() => setIsEditingWeight(true)}
                >
                  <Text style={styles.weight}>Weight: {pet.weight}gr</Text>
                  <Ionicons name="pencil" size={20} color="#8B5E3C" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.mealsContainer}>
              <Text style={styles.sectionTitle}>Meal Schedule</Text>
              {meals.length === 0 ? (
                <View style={styles.emptyMealsContainer}>
                  <Ionicons name="restaurant-outline" size={40} color="#A89481" />
                  <Text style={styles.emptyMealsText}>No meals scheduled yet</Text>
                </View>
              ) : (
                meals.map((meal) => (
                  <View key={meal.id} style={styles.mealItem}>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealTime}>{meal.alarm}</Text>
                      <Text style={styles.mealPortion}>{meal.portion}gr</Text>
                    </View>
                    <View style={styles.mealControls}>
                      <Switch
                        value={meal.active}
                        onValueChange={(value) => toggleMealStatus(meal.id, meal.active, meal)}
                        trackColor={{ false: '#E5DED3', true: '#A89481' }}
                        thumbColor={meal.active ? '#8B5E3C' : '#F9F6F2'}
                      />
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => handleDeleteMeal(meal.id, meal)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#A05B53" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
              <TouchableOpacity 
                style={styles.addMealButton}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.addMealButtonText}>Add New Meal</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Add Meal Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add New Meal</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Portion (gr)"
                value={newMeal.portion}
                onChangeText={(text) => setNewMeal({ ...newMeal, portion: text })}
                keyboardType="numeric"
                placeholderTextColor="#A89481"
              />

              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={24} color="#8B5E3C" />
                <Text style={styles.timePickerButtonText}>
                  {newMeal.alarm.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={newMeal.alarm}
                  mode="time"
                  is24Hour={true}
                  display="default"
                  onChange={onTimeChange}
                />
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.addButton]}
                  onPress={handleAddMeal}
                >
                  <Text style={styles.buttonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.connectionStatus}>
          <View style={styles.connectionIndicator} />
          <Text style={styles.connectionText}>MQTT Connection: {mqttConnected ? 'Connected' : 'Disconnected'}</Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#F5E8C7', // Warm beige background
  },
  petName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#6D4C41', // Earthy brown
  },
  weight: {
    fontSize: 18,
    color: '#5A3E1B', // Dark brown
  },
  weightContainer: {
    backgroundColor: '#FAF3E0', // Light cream
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#6D4C41',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(109, 76, 65, 0.1)',
  },
  weightDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(109, 76, 65, 0.2)',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#F9F6F2',
    color: '#5A3E1B',
  },
  weightSaveButton: {
    backgroundColor: '#8B5E3C', // Deep wood brown
    padding: 10,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  weightSaveButtonText: {
    color: '#F9F6F2', // Light cream
    fontWeight: '600',
  },
  mealsContainer: {
    backgroundColor: '#FAF3E0', // Light cream
    borderRadius: 12,
    padding: 16,
    shadowColor: '#6D4C41',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(109, 76, 65, 0.1)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#6D4C41', // Earthy brown
  },
  emptyMealsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyMealsText: {
    fontSize: 16,
    color: '#A89481', // Medium brown
    marginTop: 12,
  },
  mealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(109, 76, 65, 0.1)',
  },
  mealInfo: {
    flex: 1,
  },
  mealTime: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#5A3E1B', // Dark brown
  },
  mealPortion: {
    fontSize: 15,
    color: '#8B5E3C', // Deep wood brown
  },
  mealControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  deleteButton: {
    padding: 8,
  },
  addMealButton: {
    backgroundColor: '#8B5E3C', // Deep wood brown
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#6D4C41',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  addMealButtonText: {
    color: '#F9F6F2', // Light cream
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(90, 62, 27, 0.5)', // Semi-transparent dark brown
  },
  modalContent: {
    backgroundColor: '#F9F6F2', // Light cream
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#6D4C41', // Earthy brown
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(109, 76, 65, 0.2)',
    backgroundColor: '#FAF3E0', // Light cream
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
    color: '#5A3E1B', // Dark brown
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(109, 76, 65, 0.2)',
    backgroundColor: '#FAF3E0', // Light cream
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  timePickerButtonText: {
    fontSize: 16,
    color: '#8B5E3C', // Deep wood brown
    marginLeft: 8,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#A89481', // Medium brown
  },
  addButton: {
    backgroundColor: '#8B5E3C', // Deep wood brown
  },
  buttonText: {
    color: '#F9F6F2', // Light cream
    fontSize: 16,
    fontWeight: '600',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  petPhoto: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#F9F6F2', // Light cream
  },
  photoPlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#FAF3E0', // Light cream
    borderRadius: 16,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(109, 76, 65, 0.2)',
  },
  uploadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF3E0', // Light cream
  },
  uploadingText: {
    marginTop: 10,
    color: '#8B5E3C', // Deep wood brown
    fontSize: 16,
  },
  changePhotoButton: {
    backgroundColor: '#8B5E3C', // Deep wood brown
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: -30,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F9F6F2', // Light cream
  },
  changePhotoButtonDisabled: {
    opacity: 0.7,
  },
  changePhotoText: {
    color: '#F9F6F2', // Light cream
    fontWeight: '600',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FAF3E0',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 94, 60, 0.1)',
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 14,
    color: '#6D4C41',
  },
});
