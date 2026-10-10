import { useCallback, useEffect, useState } from 'react';
import { getCurrentDeviceLocation, type DeviceLocation } from '../services/driverTracker';

export interface MapCamera {
  center: { latitude: number; longitude: number };
  zoom: number;
}

// Where the map starts before the device reports a position. It is a view only, never used as a location.
const START_VIEW: MapCamera = { center: { latitude: 12.9716, longitude: 77.5946 }, zoom: 11 };

/** The device's position plus the map camera that follows it. */
export function useDeviceLocation() {
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [camera, setCamera] = useState<MapCamera>(START_VIEW);

  const locate = useCallback(async (recenter = true) => {
    setIsLocating(true);
    try {
      const found = await getCurrentDeviceLocation();
      setLocationDenied(!found);
      if (found) {
        setLocation(found);
        if (recenter) setCamera({ center: { latitude: found.latitude, longitude: found.longitude }, zoom: 15 });
      }
      return found;
    } finally {
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    void locate(true);
  }, [locate]);

  return { location, setLocation, isLocating, locationDenied, locate, camera, setCamera };
}
