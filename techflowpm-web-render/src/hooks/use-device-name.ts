"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";

type DeviceState = {
  deviceName: string;
  loading: boolean;
  source: "agent" | "url" | "local" | "manual";
};

export function useDeviceName() {
  const storedDevice = useAuthStore((state) => state.deviceName);
  const setDeviceName = useAuthStore((state) => state.setDeviceName);
  const [state, setState] = useState<DeviceState>({
    deviceName: storedDevice,
    loading: true,
    source: "manual",
  });

  useEffect(() => {
    let cancelled = false;

    async function detectDevice() {
      const fromUrl = new URLSearchParams(window.location.search).get("device");
      if (fromUrl) {
        const normalized = fromUrl.trim().toUpperCase();
        if (!cancelled) {
          setDeviceName(normalized);
          setState({ deviceName: normalized, loading: false, source: "url" });
        }
        return;
      }

      if (storedDevice) {
        if (!cancelled) {
          setState({ deviceName: storedDevice, loading: false, source: "local" });
        }
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 1200);
        const response = await fetch("http://localhost:5050/device-name", {
          signal: controller.signal,
        });
        window.clearTimeout(timeout);

        if (!response.ok) {
          throw new Error("Local agent unavailable");
        }

        const payload = (await response.json()) as { deviceName?: string };
        const normalized = payload.deviceName?.trim().toUpperCase() ?? "";
        if (!cancelled) {
          setDeviceName(normalized);
          setState({ deviceName: normalized, loading: false, source: "agent" });
        }
      } catch {
        if (!cancelled) {
          setState({
            deviceName: storedDevice,
            loading: false,
            source: storedDevice ? "local" : "manual",
          });
        }
      }
    }

    void detectDevice();
    return () => {
      cancelled = true;
    };
  }, [setDeviceName, storedDevice]);

  const updateDeviceName = (value: string) => {
    const normalized = value.toUpperCase();
    setDeviceName(normalized);
    setState((current) => ({
      ...current,
      deviceName: normalized,
    }));
  };

  return {
    ...state,
    setDeviceName: updateDeviceName,
  };
}
