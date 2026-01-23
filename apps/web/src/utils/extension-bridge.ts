import { EXTENSION_SOURCE, MessageType } from "./constants";

type MessageHandler = (payload: unknown) => void;

class ExtensionBridge {
  private handlers = new Map<string, Set<MessageHandler>>();
  private connected = false;
  private connectionListeners = new Set<(connected: boolean) => void>();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("message", this.handleMessage);
      this.checkConnection();
    }
  }

  private handleMessage = (event: MessageEvent) => {
    if (event.source !== window) return;
    if (event.data?.source !== EXTENSION_SOURCE) return;

    const { type, payload } = event.data;

    if (type === MessageType.BRIDGE_READY) {
      this.setConnected(true);
    }

    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      typeHandlers.forEach((handler) => handler(payload));
    }
  };

  private setConnected(connected: boolean) {
    if (this.connected !== connected) {
      this.connected = connected;
      this.connectionListeners.forEach((listener) => listener(connected));
    }
  }

  private checkConnection() {
    this.send(MessageType.CHECK_BRIDGE);

    const retryInterval = setInterval(() => {
      if (this.connected) {
        clearInterval(retryInterval);
        return;
      }
      this.send(MessageType.CHECK_BRIDGE);
    }, 1000);

    setTimeout(() => {
      clearInterval(retryInterval);
      if (!this.connected) {
        this.setConnected(false);
      }
    }, 5000);
  }

  send(type: string, payload?: unknown) {
    window.postMessage({ type, payload }, "*");
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    listener(this.connected);

    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  waitForConnection(timeout = 5000): Promise<boolean> {
    if (this.connected) return Promise.resolve(true);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeout);

      const cleanup = this.onConnectionChange((connected) => {
        if (connected) {
          clearTimeout(timer);
          cleanup();
          resolve(true);
        }
      });
    });
  }

  async request<T>(type: string, payload?: unknown): Promise<T> {
    const isConnected = await this.waitForConnection();
    if (!isConnected) {
      throw new Error("Extension not connected");
    }

    return new Promise((resolve, reject) => {
      const responseType = this.getResponseType(type);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Request timeout: ${type}`));
      }, 120000);

      const cleanup = this.on(responseType, (response) => {
        clearTimeout(timeout);
        cleanup();
        resolve(response as T);
      });

      this.send(type, payload);
    });
  }

  private getResponseType(requestType: string): string {
    const responseMap: Record<string, string> = {
      [MessageType.GET_SCRAPED_COMMENTS]: MessageType.SCRAPED_COMMENTS_RESPONSE,
      [MessageType.GET_ACCOUNT_HANDLE]: MessageType.GET_ACCOUNT_HANDLE,
      [MessageType.SAVE_ACCOUNT_HANDLE]: MessageType.SAVE_ACCOUNT_HANDLE,
      [MessageType.GET_COMMENT_LIMIT]: MessageType.GET_COMMENT_LIMIT,
      [MessageType.SAVE_COMMENT_LIMIT]: MessageType.SAVE_COMMENT_LIMIT,
      [MessageType.GET_POST_LIMIT]: MessageType.GET_POST_LIMIT,
      [MessageType.SAVE_POST_LIMIT]: MessageType.SAVE_POST_LIMIT,
      [MessageType.GET_STORED_VIDEOS]: MessageType.GET_STORED_VIDEOS,
      [MessageType.REMOVE_VIDEO]: MessageType.REMOVE_VIDEO,
      [MessageType.REMOVE_VIDEOS]: MessageType.REMOVE_VIDEOS,
    };
    return responseMap[requestType] || requestType;
  }
}

export const bridge = typeof window !== "undefined" ? new ExtensionBridge() : null;
