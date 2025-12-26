import { supabase } from './supabase';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// Notification types
export type NotificationType = 
  | 'payroll_processed'
  | 'payroll_deadline'
  | 'salary_change'
  | 'benefit_change'
  | 'leave_approved'
  | 'leave_rejected'
  | 'attendance_issue'
  | 'system_update';

export interface CustomNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, any>;
  link?: string;
}

export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  muted_until?: string | null;
  muted_types?: NotificationType[];
  created_at?: string;
  updated_at?: string;
}

// WebSocket connection
let socket: Socket | null = null;
let notificationListeners: ((notification: CustomNotification) => void)[] = [];

// Initialize WebSocket connection
export function initializeNotifications(userId: string): void {
  // Close existing connection if any
  if (socket) {
    socket.disconnect();
  }

  // Connect to WebSocket server
  const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 'wss://api.acepayroll.com';
  socket = io(wsUrl, {
    auth: {
      token: supabase.auth.getSession().then(({ data }) => data.session?.access_token)
    },
    query: {
      userId
    }
  });

  // Set up event listeners
  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('notification', (notification: CustomNotification) => {
    // Store notification in local database
    storeNotification(notification);
    
    // Notify all listeners
    notificationListeners.forEach(listener => listener(notification));
  });

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

// Add notification listener
export function addNotificationListener(listener: (notification: CustomNotification) => void): () => void {
  notificationListeners.push(listener);
  
  // Return function to remove listener
  return () => {
    notificationListeners = notificationListeners.filter(l => l !== listener);
  };
}

// Store notification in local database
async function storeNotification(notification: CustomNotification): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .insert([notification]);
    
    if (error) {
      console.error('Error storing notification:', error);
    }
  } catch (error) {
    console.error('Failed to store notification:', error);
  }
}

// Get user notifications
export async function getUserNotifications(
  userId: string,
  limit: number = 20,
  offset: number = 0,
  includeRead: boolean = false
): Promise<CustomNotification[]> {
  let query = supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (!includeRead) {
    query = query.eq('is_read', false);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
  
  return data || [];
}

// Get unread notification count
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  
  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
  
  return count || 0;
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  
  if (error) {
    console.error('Error marking notification as read:', error);
  }
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  
  if (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

// Delete notification
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .delete()
    .eq('id', notificationId);
  
  if (error) {
    console.error('Error deleting notification:', error);
  }
}

// Get user notification preferences
export async function getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No preferences found, create default preferences
      return createDefaultNotificationPreferences(userId);
    }
    console.error('Error fetching notification preferences:', error);
    return null;
  }
  
  return data;
}

// Create default notification preferences
async function createDefaultNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const defaultPreferences: NotificationPreferences = {
    user_id: userId,
    email_enabled: true,
    in_app_enabled: true,
    muted_until: null,
    muted_types: []
  };
  
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .insert([defaultPreferences])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating default notification preferences:', error);
    return defaultPreferences;
  }
  
  return data;
}

// Update user notification preferences
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .update(preferences)
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating notification preferences:', error);
    return null;
  }
  
  return data;
}

// Mute notifications temporarily
export async function muteNotifications(
  userId: string,
  duration: '1h' | '8h' | '24h' | '7d' | 'custom',
  customDate?: Date
): Promise<void> {
  let muteUntil: Date;
  
  const now = new Date();
  
  switch (duration) {
    case '1h':
      muteUntil = new Date(now.getTime() + 60 * 60 * 1000);
      break;
    case '8h':
      muteUntil = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      break;
    case '24h':
      muteUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    case '7d':
      muteUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'custom':
      if (!customDate) {
        throw new Error('Custom date is required for custom duration');
      }
      muteUntil = customDate;
      break;
  }
  
  await updateNotificationPreferences(userId, {
    muted_until: muteUntil.toISOString()
  });
}

// Unmute notifications
export async function unmuteNotifications(userId: string): Promise<void> {
  await updateNotificationPreferences(userId, {
    muted_until: null
  });
}

// Toggle notification type mute
export async function toggleNotificationType(
  userId: string,
  type: NotificationType,
  muted: boolean
): Promise<void> {
  const preferences = await getUserNotificationPreferences(userId);
  
  if (!preferences) {
    return;
  }
  
  let mutedTypes = preferences.muted_types || [];
  
  if (muted && !mutedTypes.includes(type)) {
    mutedTypes.push(type);
  } else if (!muted) {
    mutedTypes = mutedTypes.filter(t => t !== type);
  }
  
  await updateNotificationPreferences(userId, {
    muted_types: mutedTypes
  });
}

// Send notification (for testing and manual notifications)
export async function sendNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, any>,
  link?: string
): Promise<CustomNotification | null> {
  const notification: CustomNotification = {
    id: uuidv4(),
    user_id: userId,
    type,
    title,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
    data,
    link
  };
  
  try {
    // Store in database
    const { error } = await supabase
      .from('user_notifications')
      .insert([notification]);
    
    if (error) {
      console.error('Error sending notification:', error);
      return null;
    }
    
    // Notify listeners
    notificationListeners.forEach(listener => listener(notification));
    
    return notification;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return null;
  }
}

// Check for upcoming payroll deadlines and send notifications
export async function checkPayrollDeadlines(): Promise<void> {
  try {
    // Get payroll settings
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('*')
      .single();
    
    if (settingsError) {
      console.error('Error fetching company settings:', settingsError);
      return;
    }
    
    // Calculate next payroll date
    const now = new Date();
    let nextPayrollDate: Date;
    
    switch (settings.pay_period_type) {
      case 'monthly':
        // Set to payment day of current month
        nextPayrollDate = new Date(now.getFullYear(), now.getMonth(), parseInt(settings.payment_day));
        // If already passed, move to next month
        if (nextPayrollDate < now) {
          nextPayrollDate = new Date(now.getFullYear(), now.getMonth() + 1, parseInt(settings.payment_day));
        }
        break;
      case 'biweekly':
        // This is a simplified calculation
        // In a real app, you'd need to track the biweekly schedule
        nextPayrollDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      default:
        // Default to 2 weeks from now
        nextPayrollDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    }
    
    // Check if within 3 days
    const daysUntilPayroll = Math.floor((nextPayrollDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    if (daysUntilPayroll <= 3 && daysUntilPayroll >= 0) {
      // Get all users who should receive notifications
      const { data: users, error: usersError } = await supabase
        .from('user_notification_preferences')
        .select('user_id')
        .eq('in_app_enabled', true)
        .is('muted_until', null);
      
      if (usersError) {
        console.error('Error fetching users for notifications:', usersError);
        return;
      }
      
      // Send notifications to each user
      for (const user of users) {
        await sendNotification(
          user.user_id,
          'payroll_deadline',
          'Upcoming Payroll Deadline',
          `The next payroll deadline is in ${daysUntilPayroll} day${daysUntilPayroll === 1 ? '' : 's'}.`,
          { payrollDate: nextPayrollDate.toISOString() },
          '/dashboard/payroll'
        );
      }
    }
  } catch (error) {
    console.error('Error checking payroll deadlines:', error);
  }
}