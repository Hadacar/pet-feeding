import mqtt from 'mqtt';

const MQTT_CONFIG = {
  url: "ws://192.168.1.49:9001",
  options: {
    username: "pawtelligent",
    password: "x7esY9m@Ex6&",
    keepalive: 60,
    clientId: `pawtelligent_${Math.random().toString(16).substr(2, 8)}`,
    clean: true,
    reconnectPeriod: 5000, // Reconnect every 5 seconds if connection is lost
    connectTimeout: 30 * 1000, // Give up connecting after 30 seconds
  },
  topics: {
    schedule: "/device/schedule",
    weight: "/device/weight/1kg"  // Add this line


  }
};

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.client = mqtt.connect(MQTT_CONFIG.url, MQTT_CONFIG.options);

        this.client.on('connect', () => {
          console.log('MQTT Connected');
          this.isConnected = true;
          this.subscribeToTopics();
          resolve(true);
        });

        this.client.on('error', (err) => {
          console.error('MQTT Error:', err);
          reject(err);
        });

        this.client.on('message', (topic, message) => {
          try {
            const data = JSON.parse(message.toString());
            // Notify all listeners for this topic
            if (this.listeners.has(topic)) {
              this.listeners.get(topic).forEach(callback => callback(data));
            }
          } catch (err) {
            console.error('Invalid MQTT message:', err);
          }
        });

        this.client.on('close', () => {
          this.isConnected = false;
          console.log('MQTT Connection closed');
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  subscribeToTopics() {
    Object.values(MQTT_CONFIG.topics).forEach(topic => {
      this.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`Subscribed to ${topic}`);
        }
      });
    });
  }

  addTopicListener(topic, callback) {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    this.listeners.get(topic).add(callback);
  }

  removeTopicListener(topic, callback) {
    if (this.listeners.has(topic)) {
      this.listeners.get(topic).delete(callback);
    }
  }

  publishMessage(topic, message) {
    if (!this.isConnected) {
      console.error('MQTT not connected');
      return;
    }
    
    try {
      const messageString = typeof message === 'string' ? message : JSON.stringify(message);
      this.client.publish(topic, messageString);
    } catch (err) {
      console.error('Failed to publish message:', err);
    }
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  // Helper methods for common actions
  feedNow(amount) {
    this.publishMessage(MQTT_CONFIG.topics.feedNow, JSON.stringify({ amount }));
  }

  updateSchedule(scheduleData) {
    this.publishMessage(MQTT_CONFIG.topics.schedule, JSON.stringify(scheduleData));
  }

  // Helper method for adding a meal
  addMealSchedule(mealData) {
    this.publishMessage("/device/schedule/add", mealData);
  }

  // Helper method for toggling a meal
  toggleMealSchedule(mealData) {
    this.publishMessage("/device/schedule/toggle", mealData);
  }

  // Helper method for deleting a meal
  deleteMealSchedule(mealData) {
    this.publishMessage("/device/schedule/delete", mealData);
  }

  // Helper method for updating the full schedule
  updateFullSchedule(schedule) {
    this.publishMessage("/device/schedule", { schedule });
  }
}

// Create a singleton instance
const mqttService = new MQTTService();
export default mqttService; 