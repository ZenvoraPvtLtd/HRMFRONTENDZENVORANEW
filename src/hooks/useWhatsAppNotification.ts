import { useState, useCallback, useEffect } from "react";
import * as whatsappApi from "../services/whatsappApi";

interface UseWhatsAppNotificationOptions {
    autoRefreshInterval?: number; // in milliseconds, 0 to disable
    onError?: (error: Error) => void;
    onSuccess?: (message: string) => void;
}

export const useWhatsAppNotification = (
    options: UseWhatsAppNotificationOptions = {}
) => {
    const {
        autoRefreshInterval = 5000,
        onError,
        onSuccess,
    } = options;

    const [loading, setLoading] = useState(false);
    const [queueStatus, setQueueStatus] = useState({
        pending: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
        scheduler_running: false,
        twilio_configured: false,
    });

    // Fetch queue status
    const fetchQueueStatus = useCallback(async () => {
        try {
            setLoading(true);
            const status = await whatsappApi.getQueueStatus();
            setQueueStatus(status);
        } catch (error) {
            const err = error instanceof Error ? error : new Error("Unknown error");
            onError?.(err);
        } finally {
            setLoading(false);
        }
    }, [onError]);

    // Send message immediately
    const sendMessage = useCallback(
        async (phone: string, message: string) => {
            try {
                setLoading(true);
                const result = await whatsappApi.sendWhatsAppMessage(phone, message);
                onSuccess?.("Message sent successfully");
                return result;
            } catch (error) {
                const err = error instanceof Error ? error : new Error("Unknown error");
                onError?.(err);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [onError, onSuccess]
    );

    // Schedule message
    const scheduleMessage = useCallback(
        async (
            recipientName: string,
            phone: string,
            notificationType: string,
            templateData: Record<string, any>,
            scheduledTime?: string
        ) => {
            try {
                setLoading(true);
                const result = await whatsappApi.scheduleWhatsAppMessage(
                    recipientName,
                    phone,
                    notificationType,
                    templateData,
                    scheduledTime
                );
                onSuccess?.("Message scheduled successfully");
                await fetchQueueStatus(); // Refresh status
                return result;
            } catch (error) {
                const err = error instanceof Error ? error : new Error("Unknown error");
                onError?.(err);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [onError, onSuccess, fetchQueueStatus]
    );

    // Send media message
    const sendMediaMessage = useCallback(
        async (phone: string, mediaUrl: string, caption?: string) => {
            try {
                setLoading(true);
                const result = await whatsappApi.sendMediaMessage(phone, mediaUrl, caption);
                onSuccess?.("Media message sent successfully");
                return result;
            } catch (error) {
                const err = error instanceof Error ? error : new Error("Unknown error");
                onError?.(err);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [onError, onSuccess]
    );

    // Cancel scheduled message
    const cancelMessage = useCallback(
        async (scheduleId: string) => {
            try {
                setLoading(true);
                await whatsappApi.cancelScheduledMessage(scheduleId);
                onSuccess?.("Message cancelled successfully");
                await fetchQueueStatus(); // Refresh status
            } catch (error) {
                const err = error instanceof Error ? error : new Error("Unknown error");
                onError?.(err);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [onError, onSuccess, fetchQueueStatus]
    );

    // Auto-refresh queue status
    useEffect(() => {
        if (autoRefreshInterval <= 0) return;

        fetchQueueStatus(); // Fetch immediately
        const interval = setInterval(fetchQueueStatus, autoRefreshInterval);
        return () => clearInterval(interval);
    }, [autoRefreshInterval, fetchQueueStatus]);

    return {
        loading,
        queueStatus,
        fetchQueueStatus,
        sendMessage,
        scheduleMessage,
        sendMediaMessage,
        cancelMessage,
    };
};

export default useWhatsAppNotification;
