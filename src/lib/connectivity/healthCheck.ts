// ============================================================
// Connectivity Detection
//
// Two-layer approach:
//   1. navigator.onLine — fast but unreliable (only detects NIC state)
//   2. /api/health fetch — actual connectivity verification
//
// IMPORTANT DEV NOTE:
//   In Vite dev mode, /api/health is served as raw JS source
//   (text/javascript), NOT as executable JSON. Calling response.json()
//   would throw a SyntaxError, landing in the catch block and
//   incorrectly marking the app OFFLINE even when internet is available.
//
//   Fix: check Content-Type before parsing JSON. If the response is
//   not application/json (dev mode), trust navigator.onLine instead.
//   In production (Vercel), /api/health runs server-side and returns
//   proper JSON, so the full verification path is used.
// ============================================================

import type { HealthResponse } from '@/types/api';

const HEALTH_URL = '/api/health';
const HEALTH_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 30000;

/** Returns true if we are running inside Vite's local dev server */
const IS_DEV = import.meta.env.DEV;

type ConnectivityListener = (online: boolean) => void;

class ConnectivityDetector {
  private _isOnline = navigator.onLine;
  private _listeners: Set<ConnectivityListener> = new Set();
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _lastCheck: number = 0;

  get isOnline(): boolean {
    return this._isOnline;
  }

  start(): void {
    // Browser online/offline events (fast but unreliable)
    window.addEventListener('online', this._handleBrowserOnline);
    window.addEventListener('offline', this._handleBrowserOffline);

    // Active health check polling
    this._pollTimer = setInterval(() => {
      void this.check();
    }, POLL_INTERVAL_MS);

    // Initial check
    void this.check();
  }

  stop(): void {
    window.removeEventListener('online', this._handleBrowserOnline);
    window.removeEventListener('offline', this._handleBrowserOffline);
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  subscribe(listener: ConnectivityListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  async check(): Promise<boolean> {
    // Debounce — don't check more than once per second
    const now = Date.now();
    if (now - this._lastCheck < 1000) return this._isOnline;
    this._lastCheck = now;

    // Fast fail if browser says offline
    if (!navigator.onLine) {
      this._setOnline(false);
      return false;
    }

    // In Vite dev mode, /api/health is served as JS source code, not JSON.
    // Attempting response.json() would throw a SyntaxError and permanently
    // mark the app as OFFLINE. Trust navigator.onLine in dev mode instead.
    if (IS_DEV) {
      this._setOnline(true);
      return true;
    }

    // Production: verify with actual HTTP request to the Vercel function
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      const response = await fetch(HEALTH_URL, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this._setOnline(false);
        return false;
      }

      // Guard against non-JSON responses (e.g., CDN error pages)
      const contentType = response.headers.get('Content-Type') ?? '';
      if (!contentType.includes('application/json')) {
        // Server is reachable but not returning our JSON — treat as online
        // (the request succeeded = internet is working)
        this._setOnline(true);
        return true;
      }

      try {
        const data = await response.json() as HealthResponse;
        const online = data.status === 'ok';
        this._setOnline(online);
        return online;
      } catch {
        // JSON parse error — server reachable but response malformed
        // Internet is working, so mark online
        this._setOnline(true);
        return true;
      }
    } catch {
      // Network error or timeout — genuinely offline
      this._setOnline(false);
      return false;
    }
  }

  private _handleBrowserOnline = (): void => {
    // Don't trust this alone — verify with health check
    void this.check();
  };

  private _handleBrowserOffline = (): void => {
    // Browser offline is reliable — trust it immediately
    this._setOnline(false);
  };

  private _setOnline(online: boolean): void {
    if (this._isOnline !== online) {
      this._isOnline = online;
      this._listeners.forEach((l) => l(online));
    }
  }
}

export const connectivity = new ConnectivityDetector();
