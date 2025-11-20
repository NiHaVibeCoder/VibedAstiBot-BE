import React, { useState } from 'react';
import type { TelegramSettings } from '../types';
import { testTelegramConnection, sendTelegramMessage, getTestMessageForNotificationType } from '../services/telegramService';

interface TelegramSettingsTabProps {
  telegramSettings: TelegramSettings;
  onTelegramSettingsChange: (newSettings: Partial<TelegramSettings>) => void;
}

const TelegramSettingsTab: React.FC<TelegramSettingsTabProps> = ({ telegramSettings, onTelegramSettingsChange }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSendingTestMessage, setIsSendingTestMessage] = useState<string | null>(null);

  const handleToggle = async (key: keyof TelegramSettings) => {
    // If enabling a notification type and connection is tested, send test message
    if (telegramSettings.isTested && !telegramSettings[key] && 
        (key === 'enablePeriodicMessages' || key === 'enableErrorNotifications' || 
         key === 'enableBuyNotifications' || key === 'enableSellNotifications')) {
      
      setIsSendingTestMessage(key);
      
      try {
        let notificationType: 'periodic' | 'error' | 'buy' | 'sell';
        switch (key) {
          case 'enablePeriodicMessages':
            notificationType = 'periodic';
            break;
          case 'enableErrorNotifications':
            notificationType = 'error';
            break;
          case 'enableBuyNotifications':
            notificationType = 'buy';
            break;
          case 'enableSellNotifications':
            notificationType = 'sell';
            break;
          default:
            notificationType = 'periodic';
        }
        
        const testMessage = getTestMessageForNotificationType(notificationType);
        const results = await sendTelegramMessage(telegramSettings.botToken, telegramSettings.chatId, testMessage);
        
        // Check if at least one message was sent successfully
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        if (successful.length === 0) {
          // All failed
          const firstError = failed[0]?.error || 'Unbekannter Fehler';
          throw new Error(`Fehler beim Senden: ${firstError}`);
        }
        
        // Enable the notification type after successful test message
        onTelegramSettingsChange({ [key]: true });
        const notificationNames: Record<string, string> = {
          enablePeriodicMessages: 'Regelmäßige Status-Nachrichten',
          enableErrorNotifications: 'Fehlermeldungen',
          enableBuyNotifications: 'Kauf-Benachrichtigungen',
          enableSellNotifications: 'Verkauf-Benachrichtigungen',
        };
        
        let successMessage = `Testnachricht für "${notificationNames[key] || key}" erfolgreich gesendet!`;
        if (results.length > 1) {
          if (failed.length > 0) {
            successMessage += ` (${successful.length} von ${results.length} Chat(s) erfolgreich)`;
          } else {
            successMessage += ` (an ${results.length} Chat(s) gesendet)`;
          }
        }
        setTestResult({ success: true, message: successMessage });
      } catch (error: any) {
        setTestResult({ success: false, message: `Fehler beim Senden der Testnachricht: ${error?.message || 'Unbekannter Fehler'}` });
      } finally {
        setIsSendingTestMessage(null);
      }
    } else {
      // Just toggle if disabling or connection not tested
      onTelegramSettingsChange({ [key]: !telegramSettings[key] });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newValue = e.target.value;
    onTelegramSettingsChange({ [e.target.id]: newValue });
    // Reset test status if botToken or chatId changes
    if ((e.target.id === 'botToken' || e.target.id === 'chatId') && telegramSettings.isTested) {
      onTelegramSettingsChange({ isTested: false });
      setTestResult(null);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await testTelegramConnection(telegramSettings.botToken, telegramSettings.chatId);
      setTestResult(result);
      
      if (result.success) {
        onTelegramSettingsChange({ isTested: true });
      } else {
        onTelegramSettingsChange({ isTested: false });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: `Unerwarteter Fehler: ${error?.message || 'Unbekannter Fehler'}` });
      onTelegramSettingsChange({ isTested: false });
    } finally {
      setIsTesting(false);
    }
  };

  const IntervalOptions = [
    { value: '30m', label: '30 Minuten' },
    { value: '1h', label: '1 Stunde' },
    { value: '12h', label: '12 Stunden' },
    { value: '24h', label: '24 Stunden' },
    { value: '48h', label: '48 Stunden' },
  ];

  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-4">Telegram Bot Integration</h3>
      <p className="text-sm text-slate-400 mb-6">
        Verbinde Astibot mit deinem Telegram-Bot, um Echtzeit-Benachrichtigungen über den Handelsstatus, Fehler und Trades zu erhalten.
      </p>

      <div className="space-y-6 mb-8 pb-6 border-b border-slate-700">
        <h4 className="text-lg font-semibold text-white">Bot-Verbindung</h4>
        <div>
          <label htmlFor="botToken" className="block text-sm font-medium text-slate-300 mb-1">
            Telegram Bot Token
          </label>
          <input
            type="text"
            id="botToken"
            value={telegramSettings.botToken}
            onChange={handleInputChange}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Dein Bot-Token von BotFather"
          />
          <p className="text-xs text-slate-500 mt-1">
            Erhalte deinen Bot-Token von <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">@BotFather</a> auf Telegram.
          </p>
        </div>
        <div>
          <label htmlFor="chatId" className="block text-sm font-medium text-slate-300 mb-1">
            Telegram Chat ID(s)
          </label>
          <input
            type="text"
            id="chatId"
            value={telegramSettings.chatId}
            onChange={handleInputChange}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="123456789 oder 123456789, 987654321 für mehrere"
          />
          <div className="mt-2 p-3 bg-blue-900/30 border border-blue-700/50 rounded-md">
            <p className="text-xs text-blue-300 font-semibold mb-1">💡 Mehrere Chat IDs verwenden:</p>
            <p className="text-xs text-blue-200">
              Du kannst mehrere Chat IDs eingeben, um Benachrichtigungen an mehrere Empfänger zu senden. Trenne die Chat IDs einfach durch Kommas.
            </p>
            <p className="text-xs text-blue-200 mt-2">
              <strong>Beispiel:</strong> <code className="bg-blue-900/50 px-1 rounded">123456789, 987654321, -1001234567890</code>
            </p>
            <p className="text-xs text-blue-200 mt-2">
              Jede Chat ID erhält die gleichen Benachrichtigungen. Dies ist nützlich, wenn du mehrere Telegram-Chats oder Gruppen benachrichtigen möchtest.
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Um deine Chat ID zu finden, sende eine Nachricht an deinen Bot und verwende dann einen Service wie <a href="https://api.telegram.org/bot[YOUR_BOT_TOKEN]/getUpdates" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">getUpdates</a>.
          </p>
        </div>
        
        <div className="mt-4">
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !telegramSettings.botToken || !telegramSettings.chatId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-md text-sm font-semibold transition"
          >
            {isTesting ? 'Teste Verbindung...' : 'Verbindung testen'}
          </button>
          
          {testResult && (
            <div className={`mt-3 p-3 rounded-md text-sm ${
              testResult.success 
                ? 'bg-green-900/50 border border-green-700 text-green-300' 
                : 'bg-red-900/50 border border-red-700 text-red-300'
            }`}>
              {testResult.message}
            </div>
          )}
          
          {telegramSettings.isTested && (
            <div className="mt-3 p-3 bg-green-900/50 border border-green-700 text-green-300 rounded-md text-sm">
              ✅ Verbindung erfolgreich getestet. Du kannst jetzt Nachrichtentypen aktivieren.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-white mb-4">Nachrichten-Einstellungen</h4>
        
        {!telegramSettings.isTested && (
          <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-md text-sm">
            ⚠️ Bitte teste zuerst die Bot-Verbindung, bevor du Nachrichtentypen aktivierst.
          </div>
        )}

        {/* Periodic Status Messages */}
        <div className="flex items-center justify-between">
          <label htmlFor="enablePeriodicMessages" className="text-sm font-medium text-slate-300 flex-1">
            Regelmäßige Status-Nachrichten
            {isSendingTestMessage === 'enablePeriodicMessages' && (
              <span className="ml-2 text-xs text-blue-400">Sende Testnachricht...</span>
            )}
          </label>
          <input
            type="checkbox"
            id="enablePeriodicMessages"
            checked={telegramSettings.enablePeriodicMessages}
            onChange={() => handleToggle('enablePeriodicMessages')}
            disabled={!telegramSettings.isTested || isSendingTestMessage === 'enablePeriodicMessages'}
            className="sr-only peer disabled:opacity-50"
          />
          <div className="relative w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
        </div>
        {telegramSettings.enablePeriodicMessages && (
          <div className="ml-6 mt-2">
            <label htmlFor="periodicMessageInterval" className="block text-sm font-medium text-slate-300 mb-1">
              Sendeintervall
            </label>
            <select
              id="periodicMessageInterval"
              value={telegramSettings.periodicMessageInterval}
              onChange={handleInputChange}
              className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {IntervalOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Eine Nachricht, die bestätigt, dass die Simulation/der Handel läuft und die Verbindung besteht.
            </p>
          </div>
        )}

        {/* Error Notifications */}
        <div className="flex items-center justify-between mt-4">
          <label htmlFor="enableErrorNotifications" className="text-sm font-medium text-slate-300 flex-1">
            Fehlermeldungen senden
            {isSendingTestMessage === 'enableErrorNotifications' && (
              <span className="ml-2 text-xs text-blue-400">Sende Testnachricht...</span>
            )}
          </label>
          <input
            type="checkbox"
            id="enableErrorNotifications"
            checked={telegramSettings.enableErrorNotifications}
            onChange={() => handleToggle('enableErrorNotifications')}
            disabled={!telegramSettings.isTested || isSendingTestMessage === 'enableErrorNotifications'}
            className="sr-only peer disabled:opacity-50"
          />
          <div className="relative w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
        </div>
        <p className="text-xs text-slate-500 mt-1 ml-6">
            Erhalte Benachrichtigungen bei Verbindungsabbrüchen oder anderen kritischen Fehlern.
        </p>

        {/* Buy Notifications */}
        <div className="flex items-center justify-between mt-4">
          <label htmlFor="enableBuyNotifications" className="text-sm font-medium text-slate-300 flex-1">
            Kauf-Benachrichtigungen senden
            {isSendingTestMessage === 'enableBuyNotifications' && (
              <span className="ml-2 text-xs text-blue-400">Sende Testnachricht...</span>
            )}
          </label>
          <input
            type="checkbox"
            id="enableBuyNotifications"
            checked={telegramSettings.enableBuyNotifications}
            onChange={() => handleToggle('enableBuyNotifications')}
            disabled={!telegramSettings.isTested || isSendingTestMessage === 'enableBuyNotifications'}
            className="sr-only peer disabled:opacity-50"
          />
          <div className="relative w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
        </div>
        <p className="text-xs text-slate-500 mt-1 ml-6">
            Erhalte eine Nachricht, wenn der Bot eine Kauforder ausführt (inkl. Details).
        </p>

        {/* Sell Notifications */}
        <div className="flex items-center justify-between mt-4">
          <label htmlFor="enableSellNotifications" className="text-sm font-medium text-slate-300 flex-1">
            Verkauf-Benachrichtigungen senden
            {isSendingTestMessage === 'enableSellNotifications' && (
              <span className="ml-2 text-xs text-blue-400">Sende Testnachricht...</span>
            )}
          </label>
          <input
            type="checkbox"
            id="enableSellNotifications"
            checked={telegramSettings.enableSellNotifications}
            onChange={() => handleToggle('enableSellNotifications')}
            disabled={!telegramSettings.isTested || isSendingTestMessage === 'enableSellNotifications'}
            className="sr-only peer disabled:opacity-50"
          />
          <div className="relative w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
        </div>
        <p className="text-xs text-slate-500 mt-1 ml-6">
            Erhalte eine Nachricht, wenn der Bot eine Verkauforder ausführt (inkl. Details).
        </p>
      </div>
    </div>
  );
};

export default TelegramSettingsTab;