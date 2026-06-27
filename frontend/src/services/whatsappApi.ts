import { getApiBaseUrl } from "../config/apiConfig";
import { getAuthToken } from "../utils/auth";

export interface WhatsAppSchedule {
    _id: string;
    recipient_name: string;
    phone: string;
    notification_type: string;
    template_data: Record<string, any>;
    scheduled_time: string;
    status: "pending" | "sent" | "failed" | "cancelled";
    message_sid?: string;
    error_message?: string;
    created_at: string;
    processed_at?: string;
}

export interface WhatsAppQueueStatus {
    success: boolean;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
    scheduler_running: boolean;
    twilio_configured: boolean;
}

export interface SendWhatsAppRequest {
    phone: string;
    message: string;
}

export interface ScheduleWhatsAppRequest {
    recipient_name: string;
    phone: string;
    notification_type: string;
    template_data: Record<string, any>;
    scheduled_time?: string;
}

export interface WhatsAppConfig {
    twilioSid: string;
    twilioToken: string;
    twilioFrom: string;
    wabaPhoneId: string;
    wabaToken: string;
}

export interface WhatsAppRules {
    interview: boolean;
    attendance: boolean;
    leave: boolean;
    tasks: boolean;
    offers: boolean;
    salary: boolean;
    meetings: boolean;
    deadlines: boolean;
    shortlisting: boolean;
    announcements: boolean;
}

export interface WhatsAppTemplate {
    id: string;
    name: string;
    category: string;
    text: string;
}

const API_BASE = `${getApiBaseUrl()}/api/whatsapp`;

const getAuthHeaders = () => {
    const token = getAuthToken();
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
};


// Send WhatsApp message immediately

export const sendWhatsAppMessage = async (
    phone: string,
    message: string,
    twilioSid?: string,
    twilioToken?: string,
    twilioFrom?: string
): Promise<any> => {
    const response = await fetch(`${API_BASE}/send`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ phone, message, twilio_sid: twilioSid, twilio_token: twilioToken, twilio_from: twilioFrom } as any),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send WhatsApp message");
    }

    return response.json();
};

// Schedule WhatsApp message for later

export const scheduleMeeting = async (
    title: string,
    description: string,
    scheduledAt: string,
    attendees: { name: string; phone: string }[],
    meetingLink?: string,
    location?: string,
    reminderMinutesBefore?: number
): Promise<any> => {
    const url = `${API_BASE.replace('/whatsapp', '/meeting-reminders')}/schedule`;
    const payload = {
        title,
        description,
        scheduled_at: scheduledAt,
        attendees,
        meeting_link: meetingLink,
        location,
        reminder_minutes_before: reminderMinutesBefore ?? 30,
    };
    console.debug("DEBUG whatsappApi.scheduleMeeting - POST", url, payload);

    const response = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.debug("DEBUG whatsappApi.scheduleMeeting - response", url, response.status, data);

    if (!response.ok) {
        throw new Error(data.message || "Failed to schedule meeting");
    }
    return data;
};
export const scheduleWhatsAppMessage = async (
    recipientName: string,
    phone: string,
    notificationType: string,
    templateData: Record<string, any>,
    scheduledTime?: string
): Promise<any> => {
    const response = await fetch(`${API_BASE}/schedule`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
            recipient_name: recipientName,
            phone,
            notification_type: notificationType,
            template_data: templateData,
            scheduled_time: scheduledTime,
        } as ScheduleWhatsAppRequest),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to schedule WhatsApp message");
    }

    return response.json();
};

// Get queue status
export const getQueueStatus = async (): Promise<WhatsAppQueueStatus> => {
    const response = await fetch(`${API_BASE}/status`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error("Failed to fetch queue status");
    }

    return response.json();
};

// Get all scheduled messages

export const getScheduledMessages = async (
    limit: number = 100
): Promise<WhatsAppSchedule[]> => {
    const response = await fetch(`${API_BASE}/schedules?limit=${limit}`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error("Failed to fetch scheduled messages");
    }

    const data = await response.json();
    return data.data || data.schedules || [];
};


//  Send bulk broadcast message (Employee Announcement)

export const sendBroadcastMessage = async (
    title: string,
    content: string,
    authorName: string = "HR Department",
    sendToAll: boolean = true,
    recipientPhones: string[] = []
): Promise<any> => {
    const response = await fetch(`${getApiBaseUrl()}/api/announcements/create`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
            title,
            content,
            author_name: authorName,
            priority: "Normal",
            send_to_all: sendToAll,
            recipient_phones: recipientPhones
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.message || "Failed to send broadcast");
    }

    return response.json();
};

// Cancel a scheduled message
export const cancelScheduledMessage = async (scheduleId: string): Promise<any> => {
    const response = await fetch(`${API_BASE}/${scheduleId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to cancel scheduled message");
    }

    return response.json();
};


//  Send media message (PDF, image, etc.)

export const sendMediaMessage = async (
    phone: string,
    mediaUrl: string,
    caption?: string
): Promise<any> => {
    const response = await fetch(`${API_BASE}/send-media`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
            phone,
            media_url: mediaUrl,
            caption: caption || "",
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send media message");
    }

    return response.json();
};

// Get WhatsApp configuration
export const getWhatsAppConfig = async (): Promise<WhatsAppConfig> => {
    const response = await fetch(`${API_BASE}/config`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to load WhatsApp config");
    }

    const data = await response.json();
    return data.data as WhatsAppConfig;
};

export const saveWhatsAppConfig = async (config: Partial<WhatsAppConfig>): Promise<any> => {
    const response = await fetch(`${API_BASE}/config`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
            twilio_sid: config.twilioSid,
            twilio_token: config.twilioToken,
            twilio_from: config.twilioFrom,
            waba_phone_id: config.wabaPhoneId,
            waba_token: config.wabaToken,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save WhatsApp config");
    }

    return response.json();
};

export const getWhatsAppRules = async (): Promise<WhatsAppRules> => {
    const response = await fetch(`${API_BASE}/rules`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to load WhatsApp rules");
    }

    const data = await response.json();
    return data.data as WhatsAppRules;
};

export const saveWhatsAppRules = async (rules: WhatsAppRules): Promise<any> => {
    const response = await fetch(`${API_BASE}/rules`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(rules),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save WhatsApp rules");
    }

    return response.json();
};

export const getWhatsAppTemplates = async (): Promise<WhatsAppTemplate[]> => {
    const response = await fetch(`${API_BASE}/templates`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to load WhatsApp templates");
    }

    const data = await response.json();
    return data.data as WhatsAppTemplate[];
};

export const saveWhatsAppTemplates = async (templates: WhatsAppTemplate[]): Promise<any> => {
    const response = await fetch(`${API_BASE}/templates`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ templates }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save WhatsApp templates");
    }

    return response.json();
};

export const broadcastMessage = async (
    department: string,
    message: string,
    mediaUrl?: string,
    mediaCaption?: string
): Promise<any> => {
    const response = await fetch(`${API_BASE}/broadcast/send`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
            department,
            message,
            media_url: mediaUrl,
            media_caption: mediaCaption,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to broadcast WhatsApp message");
    }

    return response.json();
};

export const bulkScheduleMessages = async (
    recipients: Array<{ name: string; phone: string; template_data: Record<string, any> }>,
    notificationType: string,
    scheduledTime?: string
): Promise<any> => {
    const response = await fetch(`${API_BASE}/broadcast/schedule`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
            recipients,
            notification_type: notificationType,
            scheduled_time: scheduledTime,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to schedule bulk messages");
    }

    return response.json();
};

const whatsappApi = {
    sendWhatsAppMessage,
    scheduleWhatsAppMessage,
    getQueueStatus,
    getScheduledMessages,
    cancelScheduledMessage,
    sendMediaMessage,
    getWhatsAppConfig,
    saveWhatsAppConfig,
    getWhatsAppRules,
    saveWhatsAppRules,
    getWhatsAppTemplates,
    saveWhatsAppTemplates,
    broadcastMessage,
    bulkScheduleMessages,
};

export default whatsappApi;
