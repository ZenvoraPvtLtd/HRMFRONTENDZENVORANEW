export const LAN_IP = import.meta.env.VITE_LAN_IP || "192.168.29.31";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || "8000";

export const OFFICE_FRONTEND_ORIGIN = import.meta.env.VITE_OFFICE_FRONTEND_URL || "https://attendance.office.local";

export function getApiBaseUrl(): string {
  const configured =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_FASTAPI_URL ||
    import.meta.env.VITE_CHAT_API_URL;

  if (configured) {
    return String(configured).replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname.includes("vercel.app")) {
      return "https://zenvora-hrm.onrender.com";
    }
    return `${protocol}//${hostname}:${BACKEND_PORT}`;
  }

  return `http://127.0.0.1:${BACKEND_PORT}`;
}

export function getFrontendOrigin(): string {
  const configured = import.meta.env.VITE_FRONTEND_URL;
  if (configured) {
    return String(configured).replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

export function getQrAttendanceUrl(token: string): string {
  const configured =
    import.meta.env.VITE_QR_FRONTEND_URL ||
    import.meta.env.VITE_FRONTEND_URL;

  if (configured) {
    return `${String(configured).replace(/\/$/, "")}/qr-attendance?token=${encodeURIComponent(token)}`;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const officeQr = import.meta.env.VITE_QR_OFFICE_FRONTEND_URL || import.meta.env.VITE_OFFICE_FRONTEND_URL;
    if (officeQr) {
      const url = new URL(officeQr);
      return `${url.protocol}//${url.host}/qr-attendance?token=${encodeURIComponent(token)}`;
    }
    const qrHost = LOOPBACK_HOSTS.has(hostname) && LAN_IP ? LAN_IP : hostname;
    const portSuffix = port ? `:${port}` : "";
    return `${protocol}//${qrHost}${portSuffix}/qr-attendance?token=${encodeURIComponent(token)}`;
  }

  return `${getFrontendOrigin()}/qr-attendance?token=${encodeURIComponent(token)}`;
}

export function getQrNetworkWarning(): string {
  if (typeof window === "undefined") return "";

  const configured =
    import.meta.env.VITE_QR_FRONTEND_URL ||
    import.meta.env.VITE_FRONTEND_URL ||
    import.meta.env.VITE_QR_HOST ||
    import.meta.env.VITE_LAN_HOST;

  if (configured) return "";

  return LOOPBACK_HOSTS.has(window.location.hostname)
    ? " "
    : "";
}

export function getFrontendLoginUrl(): string {
  return `${getFrontendOrigin()}/login`;
}

export function getQrFrontendOrigin(): string {
  const configured =
    import.meta.env.VITE_FRONTEND_URL ||
    import.meta.env.VITE_QR_FRONTEND_URL;

  if (configured) {
    return String(configured).replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const officeOrigin = typeof OFFICE_FRONTEND_ORIGIN !== "undefined" && OFFICE_FRONTEND_ORIGIN ? OFFICE_FRONTEND_ORIGIN : null;
    const baseHost = officeOrigin ? new URL(officeOrigin).hostname : (LOOPBACK_HOSTS.has(hostname) && LAN_IP ? LAN_IP : hostname);
    const basePort = officeOrigin ? new URL(officeOrigin).port : (port ? `:${port}` : "");
    const portSuffix = basePort || "";
    return `${protocol}//${baseHost}${portSuffix}`;
  }

  return "http://localhost:5173";
}

export function buildQrAttendanceUrl(token: string, scanUrl?: string): string {
  const cleaned = String(scanUrl || "").trim();
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  const origin = getQrFrontendOrigin().replace(/\/$/, "");
  return `${origin}/qr-attendance?token=${encodeURIComponent(token)}`;
}
export function getFrontendInviteLoginUrl(): string {
  return `${getFrontendLoginUrl()}?invite=1`;
}

export default getApiBaseUrl();
