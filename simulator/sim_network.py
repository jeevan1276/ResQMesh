"""
Main simulator runner.

Usage:
  python sim_network.py              # Run default 4-node network
  python sim_network.py --nodes 6    # Run 6-node network
  python sim_network.py --test       # Run unit tests
"""

import asyncio
import sys
import argparse
import time
from node import SimNode


async def run_network(num_nodes: int = 4):
    """
    Run a simulated mesh network.
    
    Topology: Linear chain (Node 1 - Node 2 - Node 3 - Node 4)
    
    Args:
        num_nodes: Number of nodes to simulate
    """
    
    print(f"\n{'='*60}")
    print(f"DisasterMesh Simulator - {num_nodes} nodes")
    print(f"{'='*60}\n")
    
    # Create nodes
    base_port = 5000
    nodes = []
    
    for i in range(1, num_nodes + 1):
        port = base_port + i
        
        # Each node connects to the next one (linear topology)
        peer_ports = []
        if i < num_nodes:
            peer_ports.append(base_port + i + 1)
        if i > 1:
            peer_ports.append(base_port + i - 1)
        
        node = SimNode(node_id=i, port=port, peer_ports=peer_ports)
        nodes.append(node)
    
    # Start all nodes
    print("Starting nodes...")
    tasks = [asyncio.create_task(node.start()) for node in nodes]
    
    # Wait for startup
    await asyncio.sleep(1)
    
    # Connect all nodes
    print("Connecting nodes...")
    for node in nodes:
        await node.connect_to_peers()
    
    await asyncio.sleep(1)
    
    # Simulate messages
    print("\n" + "="*60)
    print("SIMULATION STARTING")
    print("="*60 + "\n")
    
    # Send message from node 1
    print("[T+0s] Node 1 sends DISTRESS message")
    await nodes[0].send_message("FIRE AT SECTOR A", urgent=True)
    
    await asyncio.sleep(2)
    
    # Send message from last node
    print(f"\n[T+2s] Node {num_nodes} sends STATUS message")
    await nodes[-1].send_message("SAFE ZONE OK", urgent=False)
    
    await asyncio.sleep(2)
    
    # Send message from middle node
    middle_idx = num_nodes // 2
    print(f"\n[T+4s] Node {middle_idx+1} sends RESOURCE request")
    await nodes[middle_idx].send_message("NEED WATER", urgent=True)
    
    await asyncio.sleep(3)
    
    # Print final statistics
    print("\n" + "="*60)
    print("SIMULATION COMPLETE - Final Statistics")
    print("="*60 + "\n")
    
    total_msgs = 0
    for i, node in enumerate(nodes, 1):
        count = node.get_db_size()
        total_msgs += count
        print(f"Node {i}: {count} unique messages")
        for msg in node.get_messages():
            print(f"  - [{msg['msg_type']}] {msg['payload'][:20]} (from {msg['origin_id']}, hop {msg['hop_count']})")
    
    print(f"\nTotal unique messages across network: {total_msgs}")
    
    # Calculate efficiency
    if num_nodes > 0:
        expected_msgs_per_node = 3  # We sent 3 different messages
        efficiency = (total_msgs / (num_nodes * expected_msgs_per_node)) * 100
        print(f"Propagation efficiency: {efficiency:.1f}%")
    
    # Cleanup
    print("\n[CLEANUP] Stopping nodes...")
    for task in tasks:
        task.cancel()
    
    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        pass


def main():
    parser = argparse.ArgumentParser(description="DisasterMesh Simulator")
    parser.add_argument("--nodes", type=int, default=4, help="Number of nodes")
    
    args = parser.parse_args()
    
    try:
        asyncio.run(run_network(num_nodes=args.nodes))
    except KeyboardInterrupt:
        print("\n\n[INTERRUPT] Simulation stopped by user")
        sys.exit(0)


if __name__ == "__main__":
    main()
