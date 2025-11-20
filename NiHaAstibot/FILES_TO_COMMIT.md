# Dateien für GitHub Commit

## 📝 Neue Dateien (müssen hinzugefügt werden)

### Backend-Architektur
1. **`server.js`** - Backend-Server mit Express und WebSocket
2. **`services/backendService.ts`** - Frontend-Backend-Kommunikation
3. **`hooks/useBackendTradingSimulator.ts`** - Backend-basierter Trading-Hook

### Dokumentation
4. **`BACKEND_SETUP.md`** - Setup-Anleitung für Backend
5. **`COMMIT_NOTES.md`** - Aktualisierte Commit-Notes

## 🔄 Geänderte Dateien (bereits im Repository)

### Hauptdateien
1. **`App.tsx`** - Verwendet jetzt Backend-Hook, Einstellungs-Laden/Speichern
2. **`package.json`** - Neue Dependencies (express, ws), neue Scripts
3. **`vite.config.ts`** - Proxy-Konfiguration für Development

### Components
4. **`components/TelegramSettingsTab.tsx`** - Test-Funktion, mehrere Chat IDs, UI-Hinweise
5. **`components/SettingsModal.tsx`** - Reset-Funktion, Credentials-Laden

### Services
6. **`services/telegramService.ts`** - Mehrere Chat IDs, Testfunktionen

### Hooks
7. **`hooks/useTradingSimulator.ts`** - Verbesserte Fehlerbehandlung für mehrere Chat IDs

## ✅ Bereits committed (nicht erneut hochladen)

- `services/settingsService.ts` - Bereits im Repository
- `types.ts` - Bereits committed
- `constants.ts` - Bereits committed

## 📋 Git-Befehle zum Committen

```bash
# Neue Dateien hinzufügen
git add server.js
git add services/backendService.ts
git add hooks/useBackendTradingSimulator.ts
git add BACKEND_SETUP.md
git add COMMIT_NOTES.md

# Geänderte Dateien hinzufügen
git add App.tsx
git add package.json
git add vite.config.ts
git add components/TelegramSettingsTab.tsx
git add components/SettingsModal.tsx
git add services/telegramService.ts
git add hooks/useTradingSimulator.ts

# Commit erstellen
git commit -m "Add backend architecture for background trading and improve Telegram integration

- Add Node.js backend server with WebSocket support
- Implement background trading that continues when browser is closed
- Add backend service for frontend-backend communication
- Add useBackendTradingSimulator hook
- Improve Telegram integration with connection testing
- Support multiple chat IDs (comma-separated)
- Add persistent settings storage
- Add reset functionality for settings
- Update documentation with setup instructions"
```

## 📦 Dateien-Übersicht für manuellen Upload

Wenn du die Dateien manuell über GitHub hochlädst, benötigst du:

### Neue Dateien (im Root-Verzeichnis):
- `server.js`
- `BACKEND_SETUP.md`
- `COMMIT_NOTES.md`

### Neue Dateien (in Unterverzeichnissen):
- `services/backendService.ts`
- `hooks/useBackendTradingSimulator.ts`

### Geänderte Dateien (überschreiben):
- `App.tsx`
- `package.json`
- `vite.config.ts`
- `components/TelegramSettingsTab.tsx`
- `components/SettingsModal.tsx`
- `services/telegramService.ts`
- `hooks/useTradingSimulator.ts`

