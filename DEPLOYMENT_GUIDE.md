# P.U.L.S.E. - Barangay 40 & 41, Cavite City
## Opisyal na Gabay sa Pag-deploy at Pag-host (Raspberry Pi 4B & Cloud)

Ang **P.U.L.S.E. (Public Unified Logistics & Service Engine)** ay buong-buo at nakadisenyo para sa **Barangay 40 at Barangay 41, Cavite City**.

---

### MGA KAGANAPAN AT TUNTUNIN SA STORAGE AT AUTO-PURGE

1. **Sukat sa External Hard Drive (`/media/pi/Vherrsie Back-up/RESEARCH TRASH`):**
   - Ligtas ang iyong hard drive. Hindi nagre-reformat at hindi binubura ang ibang mga files mo.
   - Ang P.U.L.S.E. ay gumagawa lamang ng subfolders (`saved_logbooks`, `photos`, `purged_archives`).
   - Ang kinakain lamang ng P.U.L.S.E. ay **napaka-liit (~0.8 MB hanggang 5 MB)** para sa JSON data at lightweight compressed photos ng Kagawad proofs.
   - Makikita sa Kagawad Portal > **Raspberry Pi tab** ang live MB tracker ng folder na ito.

2. **Patakaran sa Auto-Purge:**
   - **Active/Pending Concern:** Nananatili sa active map at feed sa loob ng **3 Araw (72 oras)**. Pagkatapos ng 3 araw, kusa itong ma-auto-purge sa active feed, ngunit **permanente paring nakatala sa Pi Logbook**.
   - **Naresolbang Concern (Resolved):** Kapag na-resolve na ng Kagawad kalakip ang litrato ng proeba, ang auto-purge ay magiging **1 Araw (24 oras)** na lamang bago maalis sa active view para luminis ang mapa.
   - **Phone Memory ng Residente:** Sa mga residente, ang kanilang kopya ay naka-save sa sarili nilang telepono (`localStorage`) kaya hawak nila ang kanilang data at maaari nilang i-clear anumang oras.

3. **24/7 Automated Autostart Pagkatapos ng Brownout:**
   - Hindi mo na kailangang mag-type nang manu-mano kada bubuksan ang Pi!
   - Sundin ang Hakbang sa ibaba upang kapag nag-restart ang Raspberry Pi, kusa nang magsisimula ang `server.py` at `cloudflared tunnel`.

---

### HAKBANG-HAKBANG NA GABAY: AUTOSTART SA RASPBERRY PI 4B

#### Hakbang 1: Ihanda ang Terminal sa Raspberry Pi 4
Buksan ang Terminal sa Raspberry Pi OS (o mag-SSH gamit ang `ssh pi@192.168.1.xxx`).

#### Hakbang 2: Isulat ang Zero-Dependency `~/server.py`
Patakbuhin ito sa terminal (1-click block):
```bash
cat << 'EOF' > ~/server.py
from http.server import HTTPServer, BaseHTTPRequestHandler
import os, json, shutil, datetime

# Hard Drive Folder
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
            pulse_bytes = get_dir_size_bytes(STORAGE_DIR)
            res = {"success": True, "file": fp, "pulse_mb": round(pulse_bytes / (1024*1024), 2)}
        except Exception as e:
            res = {"error": str(e)}
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(res).encode())

HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
EOF
```

#### Hakbang 3: I-activate ang Systemd Autostart Service (Kahit Mag-brownout)
I-paste ito sa terminal ng Pi:
```bash
sudo bash -c 'cat << "EOF" > /etc/systemd/system/pulse-server.service
[Unit]
Description=P.U.L.S.E. Raspberry Pi Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
sudo systemctl enable pulse-server.service
sudo systemctl restart pulse-server.service
```

#### Hakbang 4: Autostart para sa Cloudflare Tunnel (Libreng Public Access)
```bash
sudo bash -c 'cat << "EOF" > /etc/systemd/system/pulse-tunnel.service
[Unit]
Description=P.U.L.S.E. Cloudflare Tunnel
After=network.target pulse-server.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/local/bin/cloudflared tunnel --url http://127.0.0.1:8000
Restart=always
RestartSec=8

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
sudo systemctl enable pulse-tunnel.service
sudo systemctl restart pulse-tunnel.service
```

Ngayon, kapag namatay ang kuryente o nag-reboot ang Raspberry Pi, **kusa at automated nang magbubukas ang parehong server at tunnel**!

---

### GABAY SA PAG-DEPLOY SA RENDER.COM (24/7 LIBRENG WEB APPLICATION)

Kapag nai-push mo na sa GitHub ang iyong repository (`https://github.com/lloydivanace-lang/Pulse_TrashCollectionV2`):

1. Pumunta sa **[Render.com Dashboard](https://dashboard.render.com)**.
2. Pindutin ang **New +** > **Web Service**.
3. Piliin ang iyong GitHub repository: `Pulse_TrashCollectionV2`.
4. Ilagay ang mga sumusunod na configuration:
   - **Name:** `pulse-brgy40-41`
   - **Language / Runtime:** `Node`
   - **Branch:** `main`
   - **Region:** `Singapore` (pinakamalapit sa Pilipinas)
   - **Instance Type:** `Free`
   - **Build Command:** 
     ```bash
     npm install --legacy-peer-deps && npm run build
     ```
     *(Naka-configure na rin ang `.npmrc` na may `legacy-peer-deps=true` upang kailanman ay hindi magka-`ERESOLVE` peer dependency error sa Node.js 20/22/24)*
   - **Start Command:**
     ```bash
     npm start
     ```
5. Pindutin ang **Deploy Web Service**.
6. Sa loob ng 1-2 minuto, live na ang iyong buong website sa buong mundo (hal. `https://pulse-brgy40-41.onrender.com`)!

---

### Default Credentials para sa Kagawad Portal:
- **Username:** `kagawad41` o `kagawad40` o `admin`
- **Password:** `Kagawad@Cavite2026#Brgy41!`
