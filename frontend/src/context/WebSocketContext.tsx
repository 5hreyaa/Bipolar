import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getStoredToken, WS_BASE_URL } from "../api/client";
import { WsEventMessage } from "../types";
import { useAuth } from "./AuthContext";

type ConnectionStatus = "connected" | "connecting" | "disconnected";
type WsListener = (message: WsEventMessage) => void;

interface WebSocketContextValue {
  status: ConnectionStatus;
  subscribe: (listener: WsListener) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const listenersRef = useRef<Set<WsListener>>(new Set());

  const subscribe = useCallback((listener: WsListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus("disconnected");
      return;
    }

    let isUnmounted = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;

    const connect = () => {
      const token = getStoredToken();
      if (!token || isUnmounted) return;

      setStatus("connecting");
      socket = new WebSocket(`${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`);

      socket.onopen = () => {
        if (isUnmounted) return;
        setStatus("connected");
        pingTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send("ping");
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WsEventMessage;
          if (parsed.event === "pong" || parsed.event === "connected") return;
          listenersRef.current.forEach((listener) => listener(parsed));
        } catch {
          // Ignore malformed WS payloads
        }
      };

      socket.onclose = () => {
        if (pingTimer !== null) {
          window.clearInterval(pingTimer);
          pingTimer = null;
        }
        if (!isUnmounted) {
          setStatus("disconnected");
          reconnectTimer = window.setTimeout(connect, 3500);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (pingTimer !== null) window.clearInterval(pingTimer);
      socket?.close();
    };
  }, [isAuthenticated]);

  const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return ctx;
}

