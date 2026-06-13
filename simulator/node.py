"""
SimNode - Simulates a mesh network node using TCP sockets.

Implements:
- Message creation and relay
- Deduplication via seen messages
- TTL (hop_count limit)
- Gossip sync protocol
"""

import asyncio
import json
import time
from typing import Dict, Set, Optional, Callable
from collections import defaultdict
import random

from packet import (
    encode_packet,
    decode_packet,
    create_message,
    MSG_TYPE_DISTRESS,
)


class SimNode:
    """Simulated mesh network node."""
    
    MAX_HOPS = 5
    RELAY_JITTER_MIN = 0.05  # seconds
    RELAY_JITTER_MAX = 0.15
    
    def __init__(self, node_id: int, port: int, peer_ports: list = None):
        """
        Args:
            node_id: Unique identifier for this node (0-65535)
            port: TCP port for this node
            peer_ports: List of peer ports to connect to
        """
        self.node_id = node_id
        self.port = port
        self.peer_ports = peer_ports or []
        
        # Local storage
        self.seen: Dict[int, float] = {}  # msg_id -> timestamp when seen
        self.db: Dict[int, Dict] = {}     # msg_id -> message dict
        
        # Network
        self.server = None
        self.peer_connections: Dict[int, asyncio.StreamWriter] = {}
        
        # Callbacks
        self.on_new_message: Optional[Callable] = None
        
    async def start(self):
        """Start the node and listen for peers."""
        self.server = await asyncio.start_server(
            self._handle_peer_connection,
            "127.0.0.1",
            self.port,
        )
        
        async with self.server:
            print(f"[Node {self.node_id}] Listening on port {self.port}")
            # Run until explicitly stopped
            await self.server.serve_forever()
    
    async def _handle_peer_connection(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Handle incoming connection from a peer."""
        addr = writer.get_extra_info("peername")
        print(f"[Node {self.node_id}] Peer connected from {addr}")
        
        try:
            while True:
                # Read message length (4 bytes)
                length_data = await reader.readexactly(4)
                if not length_data:
                    break
                
                length = int.from_bytes(length_data, "little")
                
                # Read message
                msg_data = await reader.readexactly(length)
                msg = json.loads(msg_data.decode("utf-8"))
                
                # Process received message
                await self._on_receive(msg)
        except asyncio.IncompleteReadError:
            print(f"[Node {self.node_id}] Peer disconnected")
        except Exception as e:
            print(f"[Node {self.node_id}] Error: {e}")
        finally:
            writer.close()
            await writer.wait_closed()
    
    async def connect_to_peers(self):
        """Connect to all peer nodes."""
        for peer_port in self.peer_ports:
            try:
                reader, writer = await asyncio.open_connection("127.0.0.1", peer_port)
                # Store connection for later use
                self.peer_connections[peer_port] = writer
                print(f"[Node {self.node_id}] Connected to peer on port {peer_port}")
            except Exception as e:
                print(f"[Node {self.node_id}] Failed to connect to port {peer_port}: {e}")
    
    async def send_message(self, text: str, msg_type: int = MSG_TYPE_DISTRESS, urgent: bool = False):
        """Create and broadcast a new message."""
        msg = create_message(
            origin_id=self.node_id,
            msg_type=msg_type,
            payload=text,
            urgent=urgent,
        )
        
        print(f"[Node {self.node_id}] Originating message: {msg}")
        
        # Store locally
        self.seen[msg["msg_id"]] = time.time()
        self.db[msg["msg_id"]] = msg
        
        # Invoke callback
        if self.on_new_message:
            self.on_new_message(msg)
        
        # Broadcast to all peers
        await self._broadcast(msg)
    
    async def _on_receive(self, msg: Dict):
        """Process a received message."""
        msg_id = msg["msg_id"]
        
        # Already seen?
        if msg_id in self.seen:
            print(f"[Node {self.node_id}] Duplicate msg {msg_id}, ignoring")
            return
        
        # TTL exceeded?
        if msg["hop_count"] >= self.MAX_HOPS:
            print(f"[Node {self.node_id}] TTL exceeded for msg {msg_id}")
            return
        
        # Record as seen
        self.seen[msg_id] = time.time()
        self.db[msg_id] = msg
        
        print(f"[Node {self.node_id}] Received msg {msg_id} from {msg['origin_id']} (hop {msg['hop_count']})")
        
        # Invoke callback
        if self.on_new_message:
            self.on_new_message(msg)
        
        # Relay after jitter
        jitter = random.uniform(self.RELAY_JITTER_MIN, self.RELAY_JITTER_MAX)
        await asyncio.sleep(jitter)
        
        msg_copy = msg.copy()
        msg_copy["hop_count"] += 1
        
        await self._broadcast(msg_copy)
    
    async def _broadcast(self, msg: Dict):
        """Send message to all connected peers."""
        msg_json = json.dumps(msg).encode("utf-8")
        length = len(msg_json).to_bytes(4, "little")
        
        for peer_port, writer in list(self.peer_connections.items()):
            try:
                writer.write(length + msg_json)
                await writer.drain()
            except Exception as e:
                print(f"[Node {self.node_id}] Failed to send to port {peer_port}: {e}")
                # Remove dead connection
                del self.peer_connections[peer_port]
    
    def get_db_size(self) -> int:
        """Return number of unique messages stored."""
        return len(self.db)
    
    def get_messages(self) -> list:
        """Return all stored messages."""
        return list(self.db.values())


# Testing
async def test_three_nodes():
    """Test three nodes in a line: Node A <-> Node B <-> Node C"""
    
    # Create nodes
    # Node A: port 5001
    # Node B: port 5002, connects to A
    # Node C: port 5003, connects to B
    
    node_a = SimNode(node_id=1, port=5001, peer_ports=[])
    node_b = SimNode(node_id=2, port=5002, peer_ports=[5001])
    node_c = SimNode(node_id=3, port=5003, peer_ports=[5002])
    
    # Start all nodes
    tasks = [
        asyncio.create_task(node_a.start()),
        asyncio.create_task(node_b.start()),
        asyncio.create_task(node_c.start()),
    ]
    
    # Wait for startup
    await asyncio.sleep(1)
    
    # Connect B to A and C to B
    await node_b.connect_to_peers()
    await asyncio.sleep(0.5)
    await node_c.connect_to_peers()
    
    # Also connect A to B and B to C (bidirectional)
    await node_a.connect_to_peers()
    
    await asyncio.sleep(0.5)
    
    # Send message from C
    print("\n=== Sending message from Node 3 ===")
    await node_c.send_message("HELP", urgent=True)
    
    # Wait for propagation
    await asyncio.sleep(2)
    
    # Print results
    print(f"\n=== Results ===")
    print(f"Node A messages: {node_a.get_db_size()}")
    print(f"Node B messages: {node_b.get_db_size()}")
    print(f"Node C messages: {node_c.get_db_size()}")
    
    # Cancel all tasks
    for task in tasks:
        task.cancel()
    
    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        pass


if __name__ == "__main__":
    asyncio.run(test_three_nodes())
