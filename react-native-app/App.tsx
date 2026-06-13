/**
 * DisasterMesh - React Native App
 * 
 * Main UI to demonstrate message passing on 3 phones
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TextInput,
  FlatList,
} from "react-native";
import { MeshBleManager } from "./MeshBleManager";
import { Message, createMessage, MSG_TYPE } from "./packet";

export default function App() {
  // Generate random node ID (0-65535)
  const nodeIdRef = useRef<number>(Math.floor(Math.random() * 65536));
  const nodeId = nodeIdRef.current;

  const [meshManager, setMeshManager] = useState<MeshBleManager | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [stats, setStats] = useState<string>("Loading...");

  // Initialize BLE
  useEffect(() => {
    const init = async () => {
      const manager = new MeshBleManager(nodeId);
      await manager.initialize();

      // Set message callback
      manager.setMessageCallback((msg) => {
        setMessages((prev) => {
          const isDuplicate = prev.some((m) => m.msg_id === msg.msg_id);
          if (isDuplicate) return prev;
          return [msg, ...prev]; // Add to top
        });
      });

      setMeshManager(manager);
      setStats(`Node ID: ${nodeId}\nStatus: Ready`);
    };

    init();

    return () => {
      if (meshManager) {
        meshManager.destroy();
      }
    };
  }, []);

  // Update stats every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (meshManager) {
        const stats_obj = meshManager.getStats();
        setStats(
          `Node ID: ${nodeId}\n` +
          `Messages: ${stats_obj.messagesStored}\n` +
          `Origins: ${stats_obj.uniqueOrigins}\n` +
          `Status: ${isScanning ? "🔴 Scanning" : "⚪ Idle"}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isScanning, meshManager]);

  const handleStartScanning = async () => {
    if (!meshManager) return;

    if (!isScanning) {
      setIsScanning(true);
      await meshManager.startScanning((deviceData) => {
        // Process device data
      });
    } else {
      setIsScanning(false);
      await meshManager.destroy();
    }
  };

  const handleStartAdvertising = async () => {
    if (!meshManager) return;

    if (!isAdvertising) {
      setIsAdvertising(true);
      await meshManager.startAdvertising();
    } else {
      setIsAdvertising(false);
    }
  };

  const handleSendMessage = async () => {
    if (!meshManager || !messageText.trim()) return;

    const msg = createMessage(
      nodeId,
      MSG_TYPE.DISTRESS,
      messageText.trim(),
      true
    );

    await meshManager.sendMessage(msg);
    setMessageText("");

    // Add to local list immediately
    setMessages((prev) => [msg, ...prev]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>DisasterMesh</Text>
        <Text style={styles.subtitle}>BLE Mesh Network Demo</Text>
      </View>

      {/* Stats Box */}
      <View style={styles.statsBox}>
        <Text style={styles.statsText}>{stats}</Text>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsSection}>
        <TouchableOpacity
          style={[
            styles.button,
            isScanning ? styles.buttonActive : styles.buttonInactive,
          ]}
          onPress={handleStartScanning}
        >
          <Text style={styles.buttonText}>
            {isScanning ? "Stop Scanning" : "Start Scanning"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            isAdvertising ? styles.buttonActive : styles.buttonInactive,
          ]}
          onPress={handleStartAdvertising}
        >
          <Text style={styles.buttonText}>
            {isAdvertising ? "Stop Advertising" : "Start Advertising"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Message Input */}
      <View style={styles.inputSection}>
        <TextInput
          style={styles.input}
          placeholder="Type message..."
          value={messageText}
          onChangeText={setMessageText}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSendMessage}
          disabled={!messageText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <View style={styles.messagesContainer}>
        <Text style={styles.messagesTitle}>
          Messages ({messages.length})
        </Text>
        <FlatList
          data={messages}
          keyExtractor={(item) => `${item.msg_id}-${item.origin_id}`}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageItem,
                item.origin_id === nodeId && styles.messageItemOwn,
              ]}
            >
              <View style={styles.messageHeader}>
                <Text style={styles.messageOrigin}>
                  From Node {item.origin_id}
                </Text>
                <Text style={styles.messageHop}>
                  {item.urgent ? "🔴 URGENT" : "⚪"} Hop {item.hop_count}
                </Text>
              </View>
              <Text style={styles.messagePayload}>{item.payload}</Text>
              <Text style={styles.messageTime}>
                ID: {item.msg_id} · {new Date(item.timestamp * 1000).toLocaleTimeString()}
              </Text>
            </View>
          )}
          scrollEnabled={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
  },
  header: {
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#2196F3",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2196F3",
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  statsBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  statsText: {
    fontSize: 13,
    color: "#333",
    fontFamily: "monospace",
    lineHeight: 20,
  },
  controlsSection: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  buttonActive: {
    backgroundColor: "#4CAF50",
  },
  buttonInactive: {
    backgroundColor: "#ddd",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  inputSection: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    color: "#333",
  },
  sendButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
  },
  messagesTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  messageItem: {
    backgroundColor: "#f9f9f9",
    borderLeftWidth: 3,
    borderLeftColor: "#FF9800",
    padding: 10,
    marginBottom: 8,
    borderRadius: 4,
  },
  messageItemOwn: {
    backgroundColor: "#E3F2FD",
    borderLeftColor: "#2196F3",
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  messageOrigin: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#333",
  },
  messageHop: {
    fontSize: 11,
    color: "#666",
  },
  messagePayload: {
    fontSize: 14,
    color: "#333",
    marginBottom: 6,
  },
  messageTime: {
    fontSize: 10,
    color: "#999",
  },
});
