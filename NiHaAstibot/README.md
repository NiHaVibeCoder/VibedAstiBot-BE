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
*   **🚀 Live-Trading (Experimentell):** Unterstützung für echte API-Verbindungen (z.B. Gemini) für den realen Handel (mit Vorsicht zu genießen!).

---

## 🛠️ Technologie-Stack

*   **Frontend:** React 19, Vite, TailwindCSS, Recharts
*   **Backend:** Node.js, Express, WebSocket (ws)
*   **Sprache:** TypeScript / JavaScript
*   **Tools:** npm

---

## 🚀 Installation & Setup

### Voraussetzungen

*   [Node.js](https://nodejs.org/) (Version 18 oder höher empfohlen)
*   npm (wird mit Node.js installiert)

### Schritt-für-Schritt Anleitung

1.  **Repository klonen oder herunterladen:**
    ```bash
    git clone <repository-url>
    cd NiHaAstibot
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

---

## ⚙️ Konfiguration

### Umgebungsvariablen

Du kannst eine `.env` Datei im Hauptverzeichnis erstellen, um Konfigurationen anzupassen (optional):

```env
# Server Port (Standard: 3000)
PORT=3000

# API Keys (für Live-Trading, optional)
GEMINI_API_KEY=dein_api_key
GEMINI_API_SECRET=dein_api_secret
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
NiHaAstibot/
├── components/         # React UI-Komponenten (Charts, Modals, Panels)
├── hooks/              # Custom React Hooks (z.B. useBackendTradingSimulator)
├── services/           # Logik für Backend-Kommunikation, Simulation, etc.
├── server.js           # Hauptdatei für den Backend-Server
├── App.tsx             # Hauptkomponente der React-App
├── index.tsx           # Einstiegspunkt für React
├── vite.config.ts      # Vite-Konfiguration (inkl. Proxy-Setup)
├── package.json        # Abhängigkeiten und Skripte
└── ...
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