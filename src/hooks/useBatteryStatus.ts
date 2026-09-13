import { useState, useEffect } from 'react';

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => any) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => any) | null;
}

export function useBatteryStatus() {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);

  useEffect(() => {
    let batteryManager: BatteryManager | null = null;

    const updateBattery = (bm: BatteryManager) => {
      const pct = Math.round(bm.level * 100);
      setBatteryLevel(pct);
      setIsCharging(bm.charging);
    };

    const handleLevelChange = () => {
      if (batteryManager) updateBattery(batteryManager);
    };

    const handleChargingChange = () => {
      if (batteryManager) updateBattery(batteryManager);
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((bm: BatteryManager) => {
          batteryManager = bm;
          setIsSupported(true);
          updateBattery(bm);

          bm.addEventListener('levelchange', handleLevelChange);
          bm.addEventListener('chargingchange', handleChargingChange);
        })
        .catch((err: any) => {
          console.warn('Battery API not available or restricted:', err);
          setIsSupported(false);
        });
    } else {
      setIsSupported(false);
    }

    return () => {
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', handleLevelChange);
        batteryManager.removeEventListener('chargingchange', handleChargingChange);
      }
    };
  }, []);

  return { batteryLevel, isCharging, isSupported };
}
