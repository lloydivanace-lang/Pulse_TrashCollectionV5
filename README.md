# P.U.L.S.E. - Barangay 40 & 41, Cavite City
### Public Unified Logistics & Service Engine

Waste Collection & Kagawad Proof Management System with Raspberry Pi Cloud Storage.

---

## 🚀 How to Deploy on Render.com (100% Free 24/7 Web App)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for P.U.L.S.E. Barangay 40 and 41"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Connect to Render**:
   - Go to [Render.com](https://render.com) and log in.
   - Click **"New +"** -> **"Web Service"**.
   - Select your GitHub repository.
   - Fill in the following settings:
     - **Name**: `pulse-barangay40-41`
     - **Runtime**: `Node`
     - **Branch**: `main`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: `Free`
   - Click **"Create Web Service"**.

Render will automatically install dependencies, build the frontend with Vite, and launch the Express backend with persistent storage on port 10000/3000!

---

## 💻 How to Run Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

3. **Build and Run for Production**:
   ```bash
   npm run build
   npm start
   ```

---

## 🍓 Raspberry Pi 4B Cloud Server

To run the permanent Raspberry Pi storage hub on your local Pi 4B:
```bash
python3 raspberry-pi-server/server.py
```
Or use the zero-dependency autostart script:
```bash
bash raspberry-pi-server/setup_autostart.sh
```

---

## 🔐 Default Kagawad Portal Credentials
- **Username**: `kagawad41` or `kagawad40` or `admin`
- **Password**: `Kagawad@Cavite2026#Brgy41!`
*(Can be changed anytime inside the Kagawad Portal).*
