import { Injectable } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface ReservationEvent {
  reservation_id: number;
  space_id: number;
  space_name: string;
  user_name: string;
  start_time: string;
  end_time: string;
  status: string;
  action: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<WebSocketMessage>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000; // 3 seconds
  private isConnecting = false;

  constructor() {}

  connect(token: string): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('[WS] Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    
    // Determine WebSocket protocol based on current page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const apiUrl = environment.apiUrl.replace(/^https?:/, '').replace(/^\/\//, '');
    const url = `${protocol}//${apiUrl}/ws?token=${token}`;

    console.log('🔌 WebSocket: Conectando a', url.replace(token, '***'));

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('✅ WebSocket: Conectado exitosamente');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 WebSocket:', message.type, message.data);
          this.messageSubject.next(message);
        } catch (error) {
          console.error('❌ WebSocket: Error parseando mensaje:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('❌ WebSocket: Error de conexión');
        this.isConnecting = false;
      };

      this.socket.onclose = (event) => {
        console.log('🔌 WebSocket: Desconectado');
        this.isConnecting = false;
        this.socket = null;

        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 WebSocket: Reintentando (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          
          timer(this.reconnectInterval).subscribe(() => {
            this.connect(token);
          });
        } else {
          console.error('❌ WebSocket: Máximo de reintentos alcanzado');
        }
      };
    } catch (error) {
      console.error('❌ WebSocket: Error al conectar:', error);
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.socket) {
      console.log('[WS] Disconnecting...');
      this.socket.close();
      this.socket = null;
    }
  }

  getMessages(): Observable<WebSocketMessage> {
    return this.messageSubject.asObservable();
  }

  // Helper methods for specific event types
  onReservationCreated(): Observable<ReservationEvent> {
    return new Observable(observer => {
      this.messageSubject.subscribe(message => {
        if (message.type === 'reservation:created') {
          observer.next(message.data as ReservationEvent);
        }
      });
    });
  }

  onReservationUpdated(): Observable<ReservationEvent> {
    return new Observable(observer => {
      this.messageSubject.subscribe(message => {
        if (message.type === 'reservation:updated') {
          observer.next(message.data as ReservationEvent);
        }
      });
    });
  }

  onReservationCancelled(): Observable<ReservationEvent> {
    return new Observable(observer => {
      this.messageSubject.subscribe(message => {
        if (message.type === 'reservation:cancelled') {
          observer.next(message.data as ReservationEvent);
        }
      });
    });
  }

  onReservationApproved(): Observable<ReservationEvent> {
    return new Observable(observer => {
      this.messageSubject.subscribe(message => {
        if (message.type === 'reservation:approved') {
          observer.next(message.data as ReservationEvent);
        }
      });
    });
  }

  onCalendarRefresh(): Observable<any> {
    return new Observable(observer => {
      this.messageSubject.subscribe(message => {
        if (message.type === 'calendar:refresh') {
          observer.next(message.data);
        }
      });
    });
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}
