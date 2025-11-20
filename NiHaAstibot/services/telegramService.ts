// services/telegramService.ts

/**
 * Parses a comma-separated string of chat IDs into an array
 */
function parseChatIds(chatIdString: string): string[] {
  if (!chatIdString) return [];
  return chatIdString
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

/**
 * Sends a message to a single chat ID
 */
async function sendTelegramMessageToSingleChat(botToken: string, chatId: string, message: string): Promise<void> {
  if (!botToken || !chatId || !message) {
    console.warn('Telegram: Missing botToken, chatId, or message. Not sending.');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const params = new URLSearchParams({
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML', // Allows for bold, italics, etc.
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API error:', errorData);
      throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
    }
    console.log(`Telegram message sent successfully to chat ${chatId}.`);
  } catch (error) {
    console.error(`Error sending Telegram message to chat ${chatId}:`, error);
    throw error;
  }
}

/**
 * Sends a message to one or more chat IDs (comma-separated)
 * Returns an array of results for each chat ID
 */
export async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<{ success: boolean; chatId: string; error?: string }[]> {
  if (!botToken || !chatId || !message) {
    console.warn('Telegram: Missing botToken, chatId, or message. Not sending.');
    return [];
  }

  const chatIds = parseChatIds(chatId);
  if (chatIds.length === 0) {
    console.warn('Telegram: No valid chat IDs found.');
    return [];
  }

  const results = await Promise.allSettled(
    chatIds.map(id => sendTelegramMessageToSingleChat(botToken, id, message))
  );

  return results.map((result, index) => ({
    success: result.status === 'fulfilled',
    chatId: chatIds[index],
    error: result.status === 'rejected' ? (result.reason as Error)?.message : undefined,
  }));
}

export async function testTelegramConnection(botToken: string, chatId: string): Promise<{ success: boolean; message: string }> {
  if (!botToken || !chatId) {
    return { success: false, message: 'Bot Token und Chat ID müssen ausgefüllt sein.' };
  }

  const chatIds = parseChatIds(chatId);
  if (chatIds.length === 0) {
    return { success: false, message: 'Keine gültigen Chat IDs gefunden. Bitte geben Sie mindestens eine Chat ID ein.' };
  }

  try {
    const testMessage = '<b>✅ Verbindungstest erfolgreich!</b>\n\nAstibot kann jetzt Nachrichten an diesen Chat senden.';
    const results = await sendTelegramMessage(botToken, chatId, testMessage);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length === 0) {
      // All failed
      const firstError = failed[0]?.error || 'Unbekannter Fehler';
      if (firstError.includes('chat not found') || firstError.includes('chat_id')) {
        return { success: false, message: 'Chat ID(s) sind ungültig. Stelle sicher, dass du eine Nachricht an den Bot gesendet hast.' };
      } else if (firstError.includes('Unauthorized') || firstError.includes('invalid token')) {
        return { success: false, message: 'Bot Token ist ungültig. Überprüfe deinen Token von @BotFather.' };
      }
      return { success: false, message: `Fehler: ${firstError}` };
    } else if (failed.length > 0) {
      // Some succeeded, some failed
      const failedIds = failed.map(r => r.chatId).join(', ');
      return { 
        success: true, 
        message: `Testnachricht wurde an ${successful.length} von ${results.length} Chat(s) erfolgreich gesendet. Fehler bei: ${failedIds}` 
      };
    } else {
      // All succeeded
      const chatCount = successful.length;
      return { 
        success: true, 
        message: `Verbindungstest erfolgreich! Testnachricht wurde an ${chatCount} Chat(s) gesendet.` 
      };
    }
  } catch (error: any) {
    const errorMessage = error?.message || 'Unbekannter Fehler';
    if (errorMessage.includes('chat not found') || errorMessage.includes('chat_id')) {
      return { success: false, message: 'Chat ID(s) sind ungültig. Stelle sicher, dass du eine Nachricht an den Bot gesendet hast.' };
    } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('invalid token')) {
      return { success: false, message: 'Bot Token ist ungültig. Überprüfe deinen Token von @BotFather.' };
    }
    return { success: false, message: `Fehler: ${errorMessage}` };
  }
}

export function getTestMessageForNotificationType(type: 'periodic' | 'error' | 'buy' | 'sell'): string {
  switch (type) {
    case 'periodic':
      return '<b>📊 Test: Regelmäßige Status-Nachrichten</b>\n\nDiese Nachricht bestätigt, dass regelmäßige Status-Nachrichten aktiviert sind.';
    case 'error':
      return '<b>🚨 Test: Fehlermeldungen</b>\n\nDiese Nachricht bestätigt, dass Fehlermeldungen aktiviert sind.';
    case 'buy':
      return '<b>💰 Test: Kauf-Benachrichtigungen</b>\n\nDiese Nachricht bestätigt, dass Kauf-Benachrichtigungen aktiviert sind.';
    case 'sell':
      return '<b>💸 Test: Verkauf-Benachrichtigungen</b>\n\nDiese Nachricht bestätigt, dass Verkauf-Benachrichtigungen aktiviert sind.';
    default:
      return '<b>✅ Testnachricht</b>\n\nDiese Nachricht bestätigt, dass die Telegram-Integration funktioniert.';
  }
}
