import { getFastApiBaseUrl } from "../config/fastApiConfig";

const CHAT_API_BASE_URL = getFastApiBaseUrl();

export type ApiContact = {
  contact_id: string;
  name: string;
  initials: string;
  role?: string | null;
  email?: string | null;
  employee_id?: string | null;
  username?: string | null;
  avatar_color: string;
  is_online: boolean;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
};

export type ApiMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  attachment_name?: string | null;
  is_read: boolean;
  created_at: string;
};

import { getAuthToken } from "../utils/auth";

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchChatContacts() {
  try {
    const response = await fetch(`${CHAT_API_BASE_URL}/api/chat/contacts`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return [];
    return (await response.json()) as ApiContact[];
  } catch{
    return [];
  }
}

export async function upsertChatContact(contact: {
  contact_id: string;
  name: string;
  initials: string;
  role: string;
  avatar_color?: string;
  is_online?: boolean;
}) {
  try {
    const response = await fetch(`${CHAT_API_BASE_URL}/api/chat/contacts`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        avatar_color: "#111827",
        is_online: true,
        ...contact,
      }),
    });
    if (!response.ok) return null;
    return (await response.json()) as ApiContact;
  } catch{
    return null;
  }
}

export async function fetchChatMessages(contactId: string) {
  try {
    const response = await fetch(`${CHAT_API_BASE_URL}/api/chat/threads/${contactId}/messages`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return [];
    return (await response.json()) as ApiMessage[];
  } catch {
    return [];
  }
}

export async function sendChatMessage(contactId: string, text: string, attachmentName?: string) {
  try {
    const response = await fetch(`${CHAT_API_BASE_URL}/api/chat/threads/${contactId}/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ text, attachment_name: attachmentName }),
    });
    if (!response.ok) return null;
    return (await response.json()) as ApiMessage;
  } catch{
    return null;
  }
}

export async function markChatRead(contactId: string) {
  try {
    await fetch(`${CHAT_API_BASE_URL}/api/chat/threads/${contactId}/read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
  } catch {
    // ignore
  }
}

export async function clearChatThread(contactId: string) {
  try {
    const response = await fetch(`${CHAT_API_BASE_URL}/api/chat/threads/${contactId}/messages`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) return;
  } catch {
    // ignore
  }
}
