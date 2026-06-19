#!/usr/bin/env python3
import http.server
import json
import urllib.parse
import urllib.request
import urllib.error
import threading
from datetime import datetime

PORT = 3000
AI_SERVICE_URL = "http://localhost:8000/classify"

# In-memory store for received messages
received_messages = []
# Set to track seen message IDs for deduplication
seen_message_ids = set()

def forward_to_ai_service(msg_data):
    """
    Forwards a message to the AI service in a background daemon thread.
    """
    def run():
        # Prepare the payload according to EmergencyRequest BaseModel
        payload = {
            "message": msg_data.get('message') or msg_data.get('payload') or '',
            "latitude": float(msg_data.get('latitude') or msg_data.get('lat') or 0.0),
            "longitude": float(msg_data.get('longitude') or msg_data.get('lon') or 0.0),
            "device_id": str(msg_data.get('device_id') or msg_data.get('origin_id') or ''),
            "timestamp": str(msg_data.get('timestamp') or msg_data.get('ts') or datetime.utcnow().isoformat())
        }
        
        req = urllib.request.Request(
            AI_SERVICE_URL,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                resp_data = response.read().decode('utf-8')
                print(f"[{datetime.now().strftime('%H:%M:%S')}] 🧠 Message [ID: {msg_data.get('global_msg_id') or msg_data.get('msg_id')}] forwarded to AI Service. Status: {response.status}")
                msg_data['synced_to_ai'] = "SUCCESS"
        except urllib.error.URLError as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Failed to forward message [ID: {msg_data.get('global_msg_id') or msg_data.get('msg_id')}] to AI Service: {e}")
            msg_data['synced_to_ai'] = "FAILED"
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Unexpected error forwarding message [ID: {msg_data.get('global_msg_id') or msg_data.get('msg_id')}]: {e}")
            msg_data['synced_to_ai'] = "FAILED"

    threading.Thread(target=run, daemon=True).start()


class MockServerRequestHandler(http.server.BaseHTTPRequestHandler):
    # Suppress default logging to stdout
    def log_message(self, format, *args):
        # Suppress standard HTTP logs to keep console output clean
        pass

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        if parsed_path.path == '/api/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            response = {"status": "ok", "message": "ResQMesh Mock Server is running"}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            print(f"[{datetime.now().strftime('%H:%M:%S')}] GET /api/health - 200 OK")
            
        elif parsed_path.path == '/api/messages':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(received_messages).encode('utf-8'))
            print(f"[{datetime.now().strftime('%H:%M:%S')}] GET /api/messages - 200 OK (returned {len(received_messages)} messages)")
            
        elif parsed_path.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.send_cors_headers()
            self.end_headers()
            
            # Auto-refresh dashboard every 5s with dark mode
            html_table = self.build_html_table()
            html = self.get_dashboard_html(html_table)
            self.wfile.write(html.encode('utf-8'))
            
        else:
            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b"Not Found")

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        if parsed_path.path == '/api/messages':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                msg_data = json.loads(post_data.decode('utf-8'))
            except json.JSONDecodeError:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode('utf-8'))
                print(f"[{datetime.now().strftime('%H:%M:%S')}] POST /api/messages - 400 Bad Request (Invalid JSON)")
                return

            # Support both format sent by Invoke-RestMethod and from mobile app
            # Format normalized to a consistent dict representation
            global_msg_id = msg_data.get('global_msg_id') or msg_data.get('msg_id')
            if not global_msg_id:
                # If no id is provided, generate a fallback
                global_msg_id = f"gen-{int(datetime.utcnow().timestamp())}-{msg_data.get('device_id', 'unknown')}"
            
            global_msg_id = str(global_msg_id)

            if global_msg_id in seen_message_ids:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Duplicate message ignored: {global_msg_id}")
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"status": "duplicate", "global_msg_id": global_msg_id}).encode('utf-8'))
                return

            # Add server-side received_at timestamp and sync status
            msg_data['received_at'] = datetime.now().isoformat()
            msg_data['synced_to_ai'] = 'PENDING'
            
            received_messages.append(msg_data)
            seen_message_ids.add(global_msg_id)
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 📥 New message added [ID: {global_msg_id}]")
            print(f"   Device ID: {msg_data.get('device_id') or msg_data.get('origin_id')}")
            print(f"   Message:   {msg_data.get('message') or msg_data.get('payload')}")
            print(f"   Priority:  {msg_data.get('priority') or ('urgent' if msg_data.get('urgent') else 'routine')}")
            
            # Forward immediately in background
            forward_to_ai_service(msg_data)

            self.send_response(201)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "global_msg_id": global_msg_id}).encode('utf-8'))
            
        elif parsed_path.path == '/api/sync':
            # Trigger manual sync of all unsynced messages
            unsynced = [msg for msg in received_messages if msg.get('synced_to_ai') != 'SUCCESS']
            for msg in unsynced:
                msg['synced_to_ai'] = 'PENDING'
                forward_to_ai_service(msg)
                
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"status": "syncing", "synced_count": len(unsynced)}).encode('utf-8'))
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 🔄 Manual sync triggered for {len(unsynced)} unsynced messages")
            
        else:
            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b"Not Found")

    def build_html_table(self):
        if not received_messages:
            return '<div class="empty-state">No messages received yet. Waiting for nodes to sync...</div>'
            
        rows = ""
        for i, msg in enumerate(reversed(received_messages)):
            # Extract fields with fallback values supporting both formats
            dev_id = msg.get('device_id') or msg.get('origin_id') or 'N/A'
            text = msg.get('message') or msg.get('payload') or 'N/A'
            msg_type = msg.get('type') or ('distress' if msg.get('msg_type') == 1 else 'status')
            
            priority = msg.get('priority')
            if priority is None:
                priority = 'high' if msg.get('urgent') else 'normal'
            priority = str(priority).upper()

            lat = msg.get('latitude') or 'N/A'
            lon = msg.get('longitude') or 'N/A'
            gps = f"{lat}, {lon}" if lat != 'N/A' else 'N/A'
            
            ts = msg.get('timestamp') or 'N/A'
            rcvd_at = msg.get('received_at', 'N/A')
            if rcvd_at != 'N/A':
                # Format to a simpler display time
                try:
                    rcvd_dt = datetime.fromisoformat(rcvd_at)
                    rcvd_at = rcvd_dt.strftime('%Y-%m-%d %H:%M:%S')
                except Exception:
                    pass
            
            msg_id = msg.get('global_msg_id') or msg.get('msg_id') or 'N/A'
            sync_status = msg.get('synced_to_ai', 'PENDING')

            priority_class = "priority-high" if "HIGH" in priority or "URGENT" in priority else "priority-normal"
            sync_class = "sync-pending"
            if sync_status == "SUCCESS":
                sync_class = "sync-success"
            elif sync_status == "FAILED":
                sync_class = "sync-failed"

            rows += f"""
            <tr class="message-row">
                <td class="index-cell">{len(received_messages) - i}</td>
                <td class="device-cell">Node {dev_id}</td>
                <td class="payload-cell">{text}</td>
                <td class="type-cell"><span class="badge type-{str(msg_type).lower()}">{msg_type}</span></td>
                <td class="priority-cell"><span class="badge {priority_class}">{priority}</span></td>
                <td class="gps-cell">{gps}</td>
                <td class="time-cell" title="Sent: {ts}">{rcvd_at}</td>
                <td class="sync-cell"><span class="badge {sync_class}">{sync_status}</span></td>
                <td class="id-cell" title="{msg_id}"><code>{str(msg_id)[:15]}...</code></td>
            </tr>
            """
            
        return f"""
        <table class="messages-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Device/Origin ID</th>
                    <th>Message Payload</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>GPS Coords</th>
                    <th>Received At</th>
                    <th>AI Sync</th>
                    <th>Message ID</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
        """

    def get_dashboard_html(self, table_content):
        # Calculate active node counts
        unique_nodes = len(set(str(msg.get('device_id') or msg.get('origin_id') or 'unknown') for msg in received_messages))
        urgent_count = sum(1 for msg in received_messages if 'high' in str(msg.get('priority', '')).lower() or msg.get('urgent') == True)
        
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ResQMesh Gateway Dashboard</title>
    <meta http-equiv="refresh" content="5">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-primary: #0b0f19;
            --bg-secondary: #161e31;
            --bg-tertiary: #1f2a45;
            --text-primary: #f3f4f6;
            --text-secondary: #9ca3af;
            --accent-blue: #3b82f6;
            --accent-green: #10b981;
            --accent-red: #ef4444;
            --accent-orange: #f59e0b;
            --border-color: #2e3c5d;
        }}
        
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        
        body {{
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            padding: 40px 20px;
            max-width: 1200px;
            margin: 0 auto;
            line-height: 1.5;
        }}
        
        header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 20px;
        }}
        
        h1 {{
            font-size: 2.2rem;
            font-weight: 700;
            background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        
        .server-status {{
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid var(--accent-green);
            color: var(--accent-green);
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.9rem;
            animation: pulse 2s infinite;
        }}
        
        @keyframes pulse {{
            0% {{ box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }}
            70% {{ box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }}
            100% {{ box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }}
        }}
        
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }}
        
        .stat-card {{
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 24px;
            position: relative;
            overflow: hidden;
        }}
        
        .stat-card::after {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: var(--accent-blue);
        }}
        
        .stat-card.messages-received::after {{
            background: var(--accent-orange);
        }}
        
        .stat-card.active-devices::after {{
            background: var(--accent-green);
        }}
        
        .stat-label {{
            font-size: 0.9rem;
            text-transform: uppercase;
            color: var(--text-secondary);
            font-weight: 600;
            letter-spacing: 0.05em;
            margin-bottom: 8px;
        }}
        
        .stat-value {{
            font-size: 2.5rem;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
        }}
        
        .section-title {{
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 20px;
            color: var(--text-primary);
        }}
        
        .messages-table {{
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }}
        
        .messages-table th {{
            background: var(--bg-tertiary);
            padding: 16px 20px;
            font-weight: 600;
            text-align: left;
            font-size: 0.9rem;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--border-color);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        
        .messages-table td {{
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-color);
            font-size: 0.95rem;
        }}
        
        .messages-table tr:last-child td {{
            border-bottom: none;
        }}
        
        .messages-table tr.message-row:hover {{
            background: rgba(59, 130, 246, 0.05);
        }}
        
        .index-cell {{
            font-weight: 600;
            color: var(--text-secondary);
            width: 60px;
        }}
        
        .device-cell {{
            font-weight: 600;
            color: var(--accent-blue);
            width: 160px;
        }}
        
        .payload-cell {{
            font-weight: 500;
            color: var(--text-primary);
        }}
        
        .badge {{
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        
        .type-distress {{
            background: rgba(239, 68, 68, 0.15);
            color: var(--accent-red);
            border: 1px solid rgba(239, 68, 68, 0.3);
        }}
        
        .type-status {{
            background: rgba(59, 130, 246, 0.15);
            color: var(--accent-blue);
            border: 1px solid rgba(59, 130, 246, 0.3);
        }}
        
        .priority-high {{
            background: rgba(239, 68, 68, 0.2);
            color: #ff8a8a;
            border: 1px solid var(--accent-red);
        }}
        
        .priority-normal {{
            background: rgba(156, 163, 175, 0.15);
            color: var(--text-secondary);
            border: 1px solid rgba(156, 163, 175, 0.3);
        }}
        
        .sync-pending {{
            background: rgba(245, 158, 11, 0.15);
            color: var(--accent-orange);
            border: 1px solid rgba(245, 158, 11, 0.3);
        }}
        
        .sync-success {{
            background: rgba(16, 185, 129, 0.15);
            color: var(--accent-green);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }}
        
        .sync-failed {{
            background: rgba(239, 68, 68, 0.15);
            color: var(--accent-red);
            border: 1px solid rgba(239, 68, 68, 0.3);
        }}
        
        .sync-btn {{
            background: linear-gradient(135deg, var(--accent-blue) 0%, #2563eb 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            cursor: pointer;
            font-family: 'Outfit', sans-serif;
            font-size: 0.9rem;
            transition: all 0.2s ease;
            box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
        }}
        
        .sync-btn:hover {{
            transform: translateY(-1px);
            box-shadow: 0 6px 12px -1px rgba(59, 130, 246, 0.3);
        }}
        
        .sync-btn:active {{
            transform: translateY(0);
        }}
        
        .sync-btn:disabled {{
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            cursor: not-allowed;
            box-shadow: none;
            transform: none;
        }}
        
        .gps-cell {{
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            color: var(--text-secondary);
        }}
        
        .time-cell {{
            color: var(--text-secondary);
            font-size: 0.85rem;
        }}
        
        .id-cell code {{
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            background: var(--bg-primary);
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
        }}
        
        .empty-state {{
            background: var(--bg-secondary);
            border: 1px dashed var(--border-color);
            border-radius: 12px;
            padding: 60px;
            text-align: center;
            color: var(--text-secondary);
            font-size: 1.1rem;
        }}
        
        footer {{
            margin-top: 60px;
            text-align: center;
            font-size: 0.85rem;
            color: var(--text-secondary);
            border-top: 1px solid var(--border-color);
            padding-top: 20px;
        }}
    </style>
</head>
<body>
    <header>
        <div>
            <h1>📡 ResQMesh Gateway Dashboard</h1>
            <p style="color: var(--text-secondary); margin-top: 4px;">Local monitoring station for disaster-zone BLE mesh syncing</p>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
            <button onclick="syncToAI()" class="sync-btn">🔄 Sync to AI</button>
            <div class="server-status">
                <span>GATEWAY RUNNING</span>
            </div>
        </div>
    </header>
    
    <div class="stats-grid">
        <div class="stat-card active-devices">
            <div class="stat-label">Active Nodes Synced</div>
            <div class="stat-value">{unique_nodes}</div>
        </div>
        <div class="stat-card messages-received">
            <div class="stat-label">Total Synced Messages</div>
            <div class="stat-value">{len(received_messages)}</div>
        </div>
        <div class="stat-card urgent-messages">
            <div class="stat-label">Urgent Alerts</div>
            <div class="stat-value" style="color: var(--accent-red);">{urgent_count}</div>
        </div>
    </div>
    
    <div class="section-title">Synchronized Logs</div>
    {table_content}
    
    <footer>
        <p>ResQMesh Server • Listening on Port {PORT} • Binds to All Network Interfaces</p>
    </footer>
    <script>
        function syncToAI() {{
            const btn = document.querySelector('.sync-btn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '🔄 Syncing...';
            
            fetch('/api/sync', {{ method: 'POST' }})
                .then(response => {{
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                }})
                .then(data => {{
                    btn.innerHTML = '✅ Syncing...';
                    setTimeout(() => {{
                        location.reload();
                    }}, 800);
                }})
                .catch(err => {{
                    btn.innerHTML = '❌ Failed';
                    setTimeout(() => {{
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }}, 2000);
                }});
        }}
    </script>
</body>
</html>"""

def run_server():
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, MockServerRequestHandler)
    print(f"\n=======================================================")
    print(f"🚀 ResQMesh Mock Server started successfully!")
    print(f"   Dashboard: http://localhost:{PORT}/")
    print(f"   API endpoint: http://localhost:{PORT}/api/messages")
    print(f"   Listening on port {PORT} (all interfaces)")
    print(f"=======================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()
        print("Server stopped.")

if __name__ == '__main__':
    run_server()