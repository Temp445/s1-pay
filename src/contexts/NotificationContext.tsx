import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { 
  NotificationType,
  CustomNotification,   
  initializeNotifications, 
  addNotificationListener, 
  getUserNotifications, 
  getUnreadNotificationCount,
  sendNotification
} from '../lib/notifications';

interface NotificationContextType {
  notifications: CustomNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  sendTestNotification: (type: NotificationType, title: string, message: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<CustomNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Initialize notifications when user is available
  useEffect(() => {
    if (!user) return;

    // Initialize WebSocket connection
    initializeNotifications(user.id);

    // Load initial notifications
    const loadNotifications = async () => {
      setLoading(true);
      try {
        const [notifs, count] = await Promise.all([
          getUserNotifications(user.id, 10),
          getUnreadNotificationCount(user.id)
        ]);
        setNotifications(notifs);
        setUnreadCount(count);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();

    // Set up notification listener
    const removeListener = addNotificationListener((notification) => {
      // Add new notification to the list
      setNotifications(prev => [notification, ...prev]);
      
      // Increment unread count
      setUnreadCount(prev => prev + 1);
      
      // Show browser notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico'
        });
      }
    });

    // Clean up on unmount
    return () => {
      removeListener();
    };
  }, [user]);

  // Function to send a test notification
  const sendTestNotification = async (type: NotificationType, title: string, message: string) => {
    if (!user) return;
    
    try {
      await sendNotification(user.id, type, title, message);
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    sendTestNotification
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}