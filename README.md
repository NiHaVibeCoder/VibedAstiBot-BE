# Astibot — Crypto Trading Bot Simulator

<div align="center">
<img width="1200" height="475" alt="Astibot Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## 📋 Übersicht

**Astibot** ist ein fortschrittlicher Crypto-Trading-Bot-Simulator, der entwickelt wurde, um Handelsstrategien in einer sicheren Umgebung zu testen, zu optimieren und zu simulieren. Er bietet eine moderne Web-Oberfläche, Echtzeit-Charts, Backtesting-Funktionen und eine nahtlose Integration mit Telegram für Benachrichtigungen.

Das Projekt besteht aus einem **React-Frontend** (Vite) und einem **Node.js-Backend**, das die Trading-Logik ausführt. Dies ermöglicht es dem Bot, auch dann weiterzulaufen, wenn der Browser geschlossen ist.

⚠️ **WICHTIG:** Dieses Projekt dient ausschließlich zu Demonstrations-, Lern- und Testzwecken. Es handelt sich **nicht** um eine Finanzberatung. Die Nutzung für echtes Trading erfolgt auf eigene Gefahr.

---

## ✨ Features

*   **📈 Echtzeit-Simulation:** Simuliert Marktbewegungen und führt Trades basierend auf konfigurierbaren Strategien aus.
*   **🔄 Backend-Execution:** Die Trading-Logik läuft auf dem Server, sodass der Bot 24/7 aktiv bleiben kann, unabhängig vom Client-Status.
*   **🔙 Backtesting:** Teste Strategien gegen historische Daten, um deren Performance zu bewerten.
*   **⚡ Optimierung:** Finde automatisch die besten Einstellungen (Risk Level, Dips Sensitivity, etc.) für ein bestimmtes Währungspaar basierend auf historischen Daten.
*   **📱 Telegram-Integration:** Erhalte Echtzeit-Benachrichtigungen über Käufe, Verkäufe und Status-Updates direkt auf dein Smartphone.
*   **📊 Interaktive Charts:** Visualisiere Preisentwicklungen, Indikatoren (SMA, MACD) und Trades direkt im Chart.
*   **⚙️ Anpassbare Strategien:** Konfiguriere Parameter wie Stop-Loss, Sell-Trigger, Risikolevel und mehr.
*   **🚀 Live-Trading (Experimentell):** Unterstützung für echte API-Verbindungen (z.B. Coinbase) für den realen Handel (mit Vorsicht zu genießen!).
*   **🍓 Raspberry Pi Ready:** Optimiert für 24/7 Betrieb auf Raspberry Pi mit automatischem Neustart und Netzwerkzugriff.

---

## 🛠️ Technologie-Stack

*   **Frontend:** React 19, Vite, TailwindCSS, Recharts
*   **Backend:** Node.js, Express, WebSocket (ws)
*   **Process Management:** PM2 (für 24/7 Betrieb)
*   **Sprache:** TypeScript / JavaScript
*   **Tools:** npm

---

## 🚀 Installation & Setup

### Voraussetzungen

*   [Node.js](https://nodejs.org/) (Version 18 oder höher empfohlen)
*   npm (wird mit Node.js installiert)

### Lokale Entwicklung

1.  **Repository klonen oder herunterladen:**
    ```bash
    git clone <repository-url>
    cd VibedAstiBot
    ```

2.  **Abhängigkeiten installieren:**
    ```bash
    npm install
    ```

3.  **Anwendung starten (Development):**
    Für die Entwicklung müssen Frontend und Backend separat gestartet werden.

    *   **Terminal 1 (Backend):**
        ```bash
        npm run server
        ```
        Der Server startet auf Port 3000.

    *   **Terminal 2 (Frontend):**
        ```bash
        npm run dev
        ```
        Das Frontend ist unter `http://localhost:5173` erreichbar.

4.  **Anwendung starten (Production):**
    Baut das Frontend und startet einen Server, der beides ausliefert.
    ```bash
    npm start
    ```
    Die App ist dann unter `http://localhost:3000` erreichbar.

### 🍓 Raspberry Pi Deployment (24/7 Betrieb)

Für den 24/7 Betrieb auf einem Raspberry Pi mit Netzwerkzugriff:

1.  **Automatisches Deployment:**
    ```bash
    chmod +x deploy.sh
    ./deploy.sh
    ```

2.  **Manuelle Installation:**
    ```bash
    npm install
    npm run build
    sudo npm install -g pm2
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    ```

3.  **Netzwerkzugriff:**
    Die App ist dann erreichbar unter:
    - Lokal: `http://localhost:3000`
    - Netzwerk: `http://<raspberry-pi-ip>:3000`

**📖 Detaillierte Anleitung:** Siehe [RASPBERRY_PI_SETUP.md](RASPBERRY_PI_SETUP.md) für vollständige Installationsanweisungen, Konfiguration, Troubleshooting und Wartung.

---

## ⚙️ Konfiguration

### Umgebungsvariablen

Erstelle eine `.env` Datei im Hauptverzeichnis (siehe `.env.example`):

```env
# Server Port (Standard: 3000)
PORT=3000

# Coinbase API Keys (für Live-Trading, optional)
COINBASE_API_KEY=dein_api_key
COINBASE_API_SECRET=dein_api_secret

# Node Environment
NODE_ENV=production
```

### Telegram Setup

Um Benachrichtigungen zu erhalten:

1.  Erstelle einen Bot bei Telegram über den [BotFather](https://t.me/botfather) und kopiere den **Token**.
2.  Ermittle deine **Chat ID** (z.B. über den [userinfobot](https://t.me/userinfobot)).
3.  Öffne die Astibot-Oberfläche, gehe zu **Settings** -> **Telegram**.
4.  Trage Token und Chat ID ein und klicke auf "Test Connection".
5.  Aktiviere die gewünschten Benachrichtigungstypen (Käufe, Verkäufe, Periodische Updates).

---

## 📂 Projektstruktur

```
VibedAstiBot/
├── components/              # React UI-Komponenten (Charts, Modals, Panels)
├── hooks/                   # Custom React Hooks (z.B. useBackendTradingSimulator)
├── services/                # Logik für Backend-Kommunikation, Simulation, etc.
├── server.js                # Hauptdatei für den Backend-Server
├── ecosystem.config.js      # PM2 Konfiguration für 24/7 Betrieb
├── deploy.sh                # Automatisches Deployment-Skript
├── astibot.service          # Systemd Service (Alternative zu PM2)
├── RASPBERRY_PI_SETUP.md    # Raspberry Pi Deployment-Anleitung
├── App.tsx                  # Hauptkomponente der React-App
├── index.tsx                # Einstiegspunkt für React
├── vite.config.ts           # Vite-Konfiguration (inkl. Proxy-Setup)
├── package.json             # Abhängigkeiten und Skripte
└── ...
```

---

## 🔧 PM2 Management (Raspberry Pi)

Nützliche Befehle für den 24/7 Betrieb:

```bash
# Status prüfen
pm2 status

# Logs anzeigen
pm2 logs astibot

# Anwendung neu starten
pm2 restart astibot

# Anwendung stoppen
pm2 stop astibot

# Ressourcen überwachen
pm2 monit
```

Oder verwende die npm-Skripte:

```bash
npm run pm2:status
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

---

## 🤝 Mitwirken

Beiträge sind willkommen! Wenn du einen Fehler findest oder eine Verbesserung vorschlagen möchtest:

1.  Forke das Repository.
2.  Erstelle einen neuen Branch (`git checkout -b feature/AmazingFeature`).
3.  Committe deine Änderungen (`git commit -m 'Add some AmazingFeature'`).
4.  Pushe den Branch (`git push origin feature/AmazingFeature`).
5.  Öffne einen Pull Request.

---

## 📄 Lizenz

Dieses Projekt ist aktuell nicht lizenziert. Kontaktieren Sie den Autor für Verwendungserlaubnisse.

---

## ⚠️ Haftungsausschluss

Die Software wird "wie besehen" bereitgestellt, ohne jegliche Garantie. Der Autor haftet nicht für finanzielle Verluste, die durch die Nutzung dieses Bots entstehen könnten. Krypto-Trading birgt hohe Risiken.

---

## 🔗 Weitere Ressourcen

- **[Raspberry Pi Setup Guide](RASPBERRY_PI_SETUP.md)** - Vollständige Anleitung für 24/7 Deployment
- **Coinbase API** - [Dokumentation](https://docs.cloud.coinbase.com/)
- **PM2** - [Dokumentation](https://pm2.keymetrics.io/)