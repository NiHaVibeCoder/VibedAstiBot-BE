# Backend-Setup Anleitung

Die App läuft jetzt mit einem Backend-Server, der die Trading-Simulation unabhängig vom Browser ausführt. Das bedeutet, dass die Simulation auch weiterläuft, wenn der Browser geschlossen wird.

## Installation

1. **Dependencies installieren:**
   ```bash
   npm install
   ```

2. **Frontend bauen (optional, für Production):**
   ```bash
   npm run build
   ```

## Server starten

### Development-Modus (Frontend + Backend getrennt)
```bash
# Terminal 1: Backend-Server
npm run server

# Terminal 2: Frontend (Vite Dev-Server)
npm run dev
```

### Production-Modus (Alles in einem)
```bash
npm start
```
Dies baut das Frontend und startet dann den Server, der sowohl das Frontend als auch das Backend bereitstellt.

## Server-Konfiguration

Der Server läuft standardmäßig auf Port 3000. Du kannst den Port über eine Umgebungsvariable ändern:

```bash
PORT=8080 npm run server
```

## Funktionsweise

1. **Backend-Server (`server.js`):**
   - Läuft als Node.js-Prozess
   - Führt die Trading-Simulation aus
   - Verwaltet den Trading-State
   - Sendet Updates über WebSocket an verbundene Clients
   - Sendet Telegram-Benachrichtigungen

2. **Frontend:**
   - Verbindet sich über WebSocket mit dem Backend
   - Empfängt Echtzeit-Updates vom Backend
   - Sendet Befehle (Start/Stop) an das Backend
   - Zeigt den aktuellen Status an

3. **Hintergrund-Betrieb:**
   - Die Simulation läuft im Backend weiter, auch wenn der Browser geschlossen wird
   - Beim erneuten Öffnen der Webseite wird der aktuelle Status geladen
   - Telegram-Benachrichtigungen funktionieren weiterhin

## Als Service starten (Linux/Raspberry Pi)

### Mit systemd (empfohlen):

1. Erstelle eine Service-Datei:
   ```bash
   sudo nano /etc/systemd/system/astibot.service
   ```

2. Füge folgenden Inhalt ein:
   ```ini
   [Unit]
   Description=Astibot Trading Bot
   After=network.target

   [Service]
   Type=simple
   User=raspberry
   WorkingDirectory=/home/raspberry/NiHaAstibot
   ExecStart=/usr/bin/node server.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production
   Environment=PORT=3000

   [Install]
   WantedBy=multi-user.target
   ```

3. Service aktivieren und starten:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable astibot
   sudo systemctl start astibot
   ```

4. Status prüfen:
   ```bash
   sudo systemctl status astibot
   ```

5. Logs ansehen:
   ```bash
   sudo journalctl -u astibot -f
   ```

## Troubleshooting

### Server startet nicht
- Prüfe, ob Port 3000 bereits belegt ist: `lsof -i :3000`
- Prüfe Node.js-Version: `node --version` (sollte >= 18 sein)

### WebSocket-Verbindung schlägt fehl
- Prüfe, ob der Backend-Server läuft
- Prüfe Firewall-Einstellungen
- Prüfe, ob die URL korrekt ist (Standard: `ws://localhost:3000`)

### Frontend findet Backend nicht
- Stelle sicher, dass beide auf demselben Host laufen
- Für Remote-Zugriff: Ändere `VITE_WS_URL` und `VITE_API_URL` in `.env`

## Umgebungsvariablen

Erstelle eine `.env`-Datei für Konfiguration:

```env
PORT=3000
NODE_ENV=production
```

Für das Frontend (`.env` im Root-Verzeichnis):

```env
VITE_WS_URL=ws://localhost:3000
VITE_API_URL=http://localhost:3000
```

## Wichtige Hinweise

- Der Backend-Server muss laufen, damit die Trading-Simulation funktioniert
- Wenn der Browser geschlossen wird, läuft die Simulation im Backend weiter
- Beim erneuten Öffnen wird der aktuelle Status automatisch geladen
- Telegram-Benachrichtigungen funktionieren auch ohne geöffneten Browser

