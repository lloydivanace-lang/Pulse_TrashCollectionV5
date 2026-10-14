#!/bin/bash
# =========================================================================
# P.U.L.S.E. - Barangay 40 & 41 Cavite City
# Raspberry Pi 4B Automated Boot / Brownout Recovery Setup
#
# Kapag sinaksak ang Pi o nag-restart pagkatapos ng brownout,
# Awtomatikong magbubukas ang P.U.L.S.E. Server at Cloudflare Tunnel!
# =========================================================================

set -e

echo "=========================================================="
echo "🚀 P.U.L.S.E. AUTOSTART SETUP PARA SA RASPBERRY PI 4B"
echo "=========================================================="

USER_HOME="$HOME"
PYTHON_SERVER="$USER_HOME/server.py"

# 1. Tiyakin na may server.py
if [ ! -f "$PYTHON_SERVER" ]; then
    echo "⚠️ Hindi nakita ang ~/server.py, ginagawa ang pinakabagong bersyon..."
    cat << 'EOF' > "$PYTHON_SERVER"
from http.server import HTTPServer, BaseHTTPRequestHandler
import os, json, shutil, datetime

STORAGE_DIR = "/media/pi/Vherrsie Back-up/RESEARCH TRASH"
if not os.path.exists(STORAGE_DIR):
    found = None
    if os.path.exists("/media/pi"):
        for d in os.listdir("/media/pi"):
            p = os.path.join("/media/pi", d, "RESEARCH TRASH")
            if os.path.exists(p):
                found = p
                break
    STORAGE_DIR = found or os.path.expanduser("~/pulse_storage")

os.makedirs(STORAGE_DIR, exist_ok=True)
LOGBOOKS_DIR = os.path.join(STORAGE_DIR, "saved_logbooks")
os.makedirs(LOGBOOKS_DIR, exist_ok=True)
PHOTOS_DIR = os.path.join(STORAGE_DIR, "photos")
os.makedirs(PHOTOS_DIR, exist_ok=True)
ARCHIVES_DIR = os.path.join(STORAGE_DIR, "purged_archives")
os.makedirs(ARCHIVES_DIR, exist_ok=True)

def get_dir_size_bytes(path):
    total = 0
    try:
        for root, dirs, files in os.walk(path):
            for f in files:
                fp = os.path.join(root, f)
                if not os.path.islink(fp):
                    total += os.path.getsize(fp)
    except Exception:
        pass
    return total

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        total_gb, used_gb, free_gb = 500.0, 20.0, 480.0
        try:
            total, used, free = shutil.disk_usage(STORAGE_DIR)
            total_gb = round(total / (1024**3), 1)
            used_gb = round(used / (1024**3), 1)
            free_gb = round(free / (1024**3), 1)
        except Exception:
            pass
        pulse_bytes = get_dir_size_bytes(STORAGE_DIR)
        pulse_mb = round(pulse_bytes / (1024 * 1024), 2)
        pulse_kb = round(pulse_bytes / 1024, 1)
        data = {
            "status": "ONLINE",
            "system": "P.U.L.S.E. Raspberry Pi 4B Server",
            "hardware": "Raspberry Pi 4 Model B",
            "storage_folder": STORAGE_DIR,
            "disk_total": f"{total_gb} GB",
            "disk_used": f"{used_gb} GB",
            "disk_free": f"{free_gb} GB",
            "pulse_folder_mb": pulse_mb,
            "pulse_folder_kb": pulse_kb,
            "pulse_storage_summary": f"{pulse_mb} MB ({pulse_kb} KB) lamang ang kinakain sa hard drive",
            "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        self.wfile.write(json.dumps(data).encode())
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode())
            fn = f"Logbook_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            fp = os.path.join(LOGBOOKS_DIR, fn)
            with open(fp, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            res = {"success": True, "file": fp}
        except Exception as e:
            res = {"error": str(e)}
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(res).encode())

        elif self.path.startswith("/api/system/shutdown"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "Nagsisimula na ang Safe Shutdown. Maghintay ng 5 segundo bago bunutin sa saksakan."}).encode())
            import threading, time
            def do_halt():
                time.sleep(1.5)
                os.system("sync && sudo shutdown -h now")
            threading.Thread(target=do_halt).start()
        elif self.path.startswith("/api/system/reboot"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "Nagre-reboot na ang Pi."}).encode())
            import threading, time
            def do_reboot():
                time.sleep(1.5)
                os.system("sync && sudo reboot")
            threading.Thread(target=do_reboot).start()

HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
EOF
fi

# 2. Paganahin ang Safe GPIO Power Button (Pin 5 & 6)
echo "🔌 [1/4] Sinusuri ang GPIO Safe Shutdown Overlay..."
CONFIG_TXT="/boot/firmware/config.txt"
[ ! -f "$CONFIG_TXT" ] && CONFIG_TXT="/boot/config.txt"
if [ -f "$CONFIG_TXT" ]; then
    if ! grep -q "dtoverlay=gpio-shutdown" "$CONFIG_TXT"; then
        echo "dtoverlay=gpio-shutdown" | sudo tee -a "$CONFIG_TXT" > /dev/null
        echo "   -> Naidagdag ang 'dtoverlay=gpio-shutdown'. Maaari nang gumamit ng tactile button sa Pin 5 at Pin 6!"
    else
        echo "   -> Aktibo na ang 'dtoverlay=gpio-shutdown' sa $CONFIG_TXT."
    fi
fi

# 3. Lumikha ng systemd service para sa P.U.L.S.E. Python Server
echo "⚙️ [2/4] Nililikha ang systemd service para sa P.U.L.S.E. Server..."
sudo bash -c "cat << 'EOF' > /etc/systemd/system/pulse-server.service
[Unit]
Description=P.U.L.S.E. Barangay 40 and 41 Pi Storage Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME
ExecStart=/usr/bin/python3 $HOME/server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF"

# 4. Lumikha ng systemd service para sa Cloudflare Tunnel
echo "⚙️ [3/4] Nililikha ang systemd service para sa Cloudflare Tunnel..."
sudo bash -c "cat << 'EOF' > /etc/systemd/system/pulse-tunnel.service
[Unit]
Description=P.U.L.S.E. Cloudflare Tunnel Service
After=network.target pulse-server.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME
ExecStart=/usr/local/bin/cloudflared tunnel --url http://127.0.0.1:8000
Restart=always
RestartSec=8

[Install]
WantedBy=multi-user.target
EOF"

# 5. I-reload ang systemd at paganahin ang services
echo "⚙️ [4/4] Ina-activate at pinapagana ang autostart on boot..."
sudo systemctl daemon-reload
sudo systemctl enable pulse-server.service
sudo systemctl enable pulse-tunnel.service
sudo systemctl restart pulse-server.service

echo ""
echo "=========================================================="
echo "✅ TAPOS NA! Matagumpay na naka-set up ang Autostart & Appliance Mode!"
echo "   1. Kada bukas o pagsaksak ng Pi pagkatapos ng brownout,"
echo "      KUSA at AUTOMATED nang mag-o-open ang server at tunnel!"
echo "   2. Para sa 100% Protektadong 'Saksak-Bunot' Appliance Mode nang hindi nasisira:"
echo "      Patakbuhin: sudo raspi-config -> Performance Options -> Overlay File System -> Enable"
echo "=========================================================="
