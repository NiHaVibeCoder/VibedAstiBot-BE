// services/backendService.ts - Service für Backend-Kommunikation

// In Development: Vite läuft auf 5173, Backend auf 3000
// In Production: Beide laufen auf demselben Port (3000)
const isDevelopment = import.meta.env.DEV;
const WS_URL = import.meta.env.VITE_WS_URL ||
  (isDevelopment ? `ws://${window.location.host}/ws` : `ws://${window.location.host}`);
const API_URL = import.meta.env.VITE_API_URL || '';

export interface BackendState {
  isRunning: boolean;
  account: { base: number; quote: number };
  currentPrice: number;
  trades: any[];
  chartData: any[];
  profit: number;
  backtestProgress: number;
}

type StateUpdateCallback = (state: BackendState) => void;

class BackendService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000;
  private stateUpdateCallbacks: StateUpdateCallback[] = [];
  private isConnecting = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        // Request current state
        this.send({ type: 'getState' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'state') {
            this.notifyStateUpdate(data.data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, attempting to connect...');
      this.connect();
      // Retry after a short delay
      setTimeout(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(message));
        }
      }, 1000);
    }
  }

  onStateUpdate(callback: StateUpdateCallback) {
    this.stateUpdateCallbacks.push(callback);
    return () => {
      const index = this.stateUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateUpdateCallbacks.splice(index, 1);
      }
    };
  }

  private notifyStateUpdate(state: BackendState) {
    this.stateUpdateCallbacks.forEach(callback => callback(state));
  }

  startTrading(settings: any, backtestData: any = null) {
    this.send({
      type: 'start',
      settings,
      backtestData: backtestData?.data || null,
    });
  }

  stopTrading() {
    this.send({ type: 'stop' });
  }

  updateSettings(settings: any) {
    this.send({
      type: 'updateSettings',
      settings,
    });
  }

  async getState(): Promise<BackendState | null> {
    try {
      const response = await fetch(`${API_URL}/api/state`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error fetching state:', error);
    }
    return null;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (response.ok) {
        const data = await response.json();
        return data.status === 'ok';
      }
    } catch (error) {
      console.error('Error checking health:', error);
    }
    return false;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const backendService = new BackendService();

