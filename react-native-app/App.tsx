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
  StyleSheet,
  SafeAreaView,
  TextInput,
  FlatList,
} from "react-native";
import { MeshBleManager } from "./MeshBleManager";
import { Message, createMessage, MSG_TYPE } from "./packet";
import { classifyUrgency } from "./UrgencyClassifier";
import { DEMO_MESSAGES } from "./DemoData";

export default function App() {
  // Generate random node ID (0-65535)
  const nodeIdRef = useRef<number>(Math.floor(Math.random() * 65536));
  const nodeId = nodeIdRef.current;

  const [meshManager, setMeshManager] = useState<MeshBleManager | null>(null);
  const meshManagerRef = useRef<MeshBleManager | null>(null);
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
        setMessages((prev: Message[]) => {
          const isDuplicate = prev.some((m: Message) => m.msg_id === msg.msg_id);
          if (isDuplicate) return prev;
          return [msg, ...prev]; // Add to top
        });
      });

      meshManagerRef.current = manager;
      setMeshManager(manager);
      setStats(`Node ID: ${nodeId}\nStatus: Initializing...`);

      // Automatically start scanning and advertising
      const startServices = async () => {
        await manager.startAdvertising();
        setIsAdvertising(true);
        await manager.startScanning(() => {});
        setIsScanning(true);
        setStats(`Node ID: ${nodeId}\nStatus: 🔴 Scanning & Advertising`);
      };

      startServices();
    };

    init();


    return () => {
      if (meshManagerRef.current) {
        meshManagerRef.current.destroy();
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

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    const isUrgent = classifyUrgency(messageText);
    const msg = createMessage(
      nodeId,
      MSG_TYPE.DISTRESS,
      messageText,
      isUrgent
    );

    // Add to local list immediately
    setMessages((prev: Message[]) => [msg, ...prev]);

    // Simulate relay
    if (meshManager) {
      meshManager.sendMessage(msg);
    }
  };

  const handleReplay = () => {
    let delay = 0;
    DEMO_MESSAGES.forEach((demoMsg, index) => {
      setTimeout(() => {
        const isUrgent = classifyUrgency(demoMsg.payload!);
        const msg = createMessage(
          demoMsg.origin_id!,
          MSG_TYPE.DISTRESS,
          demoMsg.payload!,
          isUrgent
        );
        // Manually set hop count for demo
        msg.hop_count = demoMsg.hop_count!;

        // Add to UI
        setMessages((prev: Message[]) => [msg, ...prev]);

        // Simulate relay
        if (meshManager) {
          meshManager.sendMessage(msg);
        }
      }, delay);
      delay += 1500; // Stagger the messages
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>DisasterMesh</Text>
        <Text style={styles.subtitle}>React Native App</Text>
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

      {/* Replay Button */}
      <TouchableOpacity style={styles.replayButton} onPress={handleReplay}>
        <Text style={styles.buttonText}>Run Demo Replay</Text>
      </TouchableOpacity>

      {/* Messages List */}
      <View style={styles.messagesContainer}>
        <Text style={styles.messagesTitle}>
          Messages ({messages.length})
        </Text>
        <FlatList
          data={messages}
          keyExtractor={(item: Message) => `${item.msg_id}-${item.origin_id}`}
          renderItem={({ item }: { item: Message }) => (
            <View
              style={[
                styles.messageItem,
                item.origin_id === nodeId && styles.messageItemOwn,
                item.urgent && styles.messageItemUrgent,
              ]}
            >
              <View style={styles.messageHeader}>
                <Text style={styles.messageOrigin}>
                  From Node {item.origin_id}
                </Text>
                <Text style={styles.messageHop}>
                  Hop {item.hop_count}
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
    backgroundColor: '#111827', // Dark background
    paddingHorizontal: 12,
  },
  header: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#F9FAFB',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statsBox: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  statsText: {
    fontSize: 13,
    color: '#D1D5DB',
    fontFamily: "monospace",
    lineHeight: 20,
  },
  inputSection: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#374151',
    color: '#F9FAFB',
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  replayButton: {
    backgroundColor: '#16A34A',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
  },
  messagesTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: '#F9FAFB',
    marginBottom: 8,
  },
  messageItem: {
    backgroundColor: '#374151',
    borderLeftWidth: 4,
    borderLeftColor: '#9CA3AF', // Default color for relayed
    padding: 10,
    marginBottom: 8,
    borderRadius: 4,
  },
  messageItemOwn: {
    backgroundColor: '#1E40AF',
    borderLeftColor: '#3B82F6',
  },
  messageItemUrgent: {
    borderLeftColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  messageOrigin: {
    fontSize: 12,
    fontWeight: "bold",
    color: '#E5E7EB',
  },
  messageHop: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  messagePayload: {
    fontSize: 15,
    color: '#F9FAFB',
    marginBottom: 6,
  },
  messageTime: {
    fontSize: 10,
    color: '#9CA3AF',
  },
});
