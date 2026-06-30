export type AttendanceLocation = {
  label: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
};

const INVALID_LABELS = new Set(["no", "none", "null", "undefined", "false", "n/a", "na"]);
const RESOLVING_LABEL = "Finding location name...";

function isCoordinateLabel(label: string) {
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(label.trim());
}

export function needsLocationEnrichment(location?: AttendanceLocation | null) {
  if (!location) return false;
  if (location.lat === undefined || location.lng === undefined) return false;

  const cleanLabel = location.label?.trim() ?? "";
  if (!cleanLabel) return true;
  if (INVALID_LABELS.has(cleanLabel.toLowerCase())) return true;
  return isCoordinateLabel(cleanLabel);
}

function buildPlaceName(data: {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  localityInfo?: {
    administrative?: Array<{ name?: string; order?: number }>;
  };
}): string {
  const admin = data.localityInfo?.administrative;
  if (Array.isArray(admin) && admin.length > 0) {
    const names = admin
      .filter((item) => typeof item.order === "number" && item.order >= 4 && item.order <= 12)
      .map((item) => item.name?.trim())
      .filter((name): name is string => Boolean(name));

    if (names.length > 0) {
      return [...new Set(names)].slice(0, 3).join(", ");
    }
  }

  const parts = [data.locality, data.city, data.principalSubdivision, data.countryName].filter(
    (part, index, arr) => Boolean(part) && arr.indexOf(part) === index,
  );
  return parts.join(", ");
}

function buildNominatimName(data: {
  display_name?: string;
  address?: Record<string, string | undefined>;
}): string {
  if (typeof data.display_name === "string" && data.display_name.trim()) {
    const short = data.display_name.split(",").slice(0, 3).map((part) => part.trim()).filter(Boolean);
    if (short.length > 0) return short.join(", ");
  }

  const address = data.address ?? {};
  const parts = [
    address.neighbourhood,
    address.suburb,
    address.city || address.town || address.village,
    address.state,
  ].filter((part, index, arr) => Boolean(part) && arr.indexOf(part) === index);

  return parts.join(", ");
}

async function reverseGeocodeBigDataCloud(lat: number, lng: number): Promise<string> {
  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
  );
  if (!response.ok) return "";

  const data = await response.json();
  return buildPlaceName(data);
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<string> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
    { headers: { Accept: "application/json", "Accept-Language": "en" } },
  );
  if (!response.ok) return "";

  const data = await response.json();
  return buildNominatimName(data);
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const primary = await reverseGeocodeBigDataCloud(lat, lng);
    if (primary) return primary;
  } catch {
    // try fallback
  }

  try {
    return await reverseGeocodeNominatim(lat, lng);
  } catch {
    return "";
  }
}

export function formatAttendanceLocation(location?: AttendanceLocation | null): string {
  if (!location) return "Location not captured";

  const cleanLabel = typeof location.label === "string" ? location.label.trim() : "";
  if (cleanLabel && !INVALID_LABELS.has(cleanLabel.toLowerCase()) && !isCoordinateLabel(cleanLabel)) {
    return cleanLabel;
  }

  if (needsLocationEnrichment(location)) {
    return RESOLVING_LABEL;
  }

  if (cleanLabel && !INVALID_LABELS.has(cleanLabel.toLowerCase())) {
    return cleanLabel;
  }

  return "Location not captured";
}

export function normalizeAttendanceLocation(value: unknown): AttendanceLocation | null {
  if (!value || typeof value !== "object") return null;

  const location = value as Partial<AttendanceLocation>;
  let label = typeof location.label === "string" ? location.label.trim() : "";
  const lat = typeof location.lat === "number" ? location.lat : undefined;
  const lng = typeof location.lng === "number" ? location.lng : undefined;
  const accuracy = typeof location.accuracy === "number" ? location.accuracy : undefined;

  if (!label && lat === undefined && lng === undefined) return null;

  if (label && (INVALID_LABELS.has(label.toLowerCase()) || isCoordinateLabel(label))) {
    label = "";
  }

  return { label, lat, lng, accuracy };
}

export async function enrichAttendanceLocation(
  location: AttendanceLocation,
): Promise<AttendanceLocation> {
  if (location.lat === undefined || location.lng === undefined) {
    return location;
  }

  if (!needsLocationEnrichment(location)) {
    return location;
  }

  const placeName = await reverseGeocode(location.lat, location.lng);
  if (!placeName) {
    return { ...location, label: "Nearby area detected" };
  }

  return { ...location, label: placeName };
}

export function captureAttendanceLocation(): Promise<AttendanceLocation> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ label: "Location unavailable on this device" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(5));
        const lng = Number(position.coords.longitude.toFixed(5));
        const accuracy = Math.round(position.coords.accuracy);
        const placeName = await reverseGeocode(lat, lng);

        resolve({
          lat,
          lng,
          accuracy,
          label: placeName || "Nearby area detected",
        });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Location permission denied — allow location in browser settings",
          2: "Location signal unavailable",
          3: "Location request timed out — try again near a window",
        };

        resolve({
          label: messages[error.code] || "Could not detect location",
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
