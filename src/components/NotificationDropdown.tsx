import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, X, Clock, Calendar, DollarSign, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Notification, 
  getUserNotifications, 
  getUnreadNotificationCount, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification 
} from '../lib/notifications';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load notifications and unread count
  useEffect(() => {
    if (!user) return;

    const loadNotifications = async () => {
      setLoading(true);
      try {
        const [notifs, count] = await Promise.all([
          getUserNotifications(user.id, 5),
          getUnreadNotificationCount(user.id)
        ]);
        setNotifications(notifs);
        setUnreadCount(count);
      } catch (error) {
        console.error('Error loading notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();

    // Set up polling for new notifications
    const interval = setInterval(loadNotifications, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    await markNotificationAsRead(notification.id);
    
    // Update local state
    setNotifications(notifications.map(n => 
      n.id === notification.id ? { ...n, is_read: true } : n
    ));
    setUnreadCount(Math.max(0, unreadCount - 1));
    
    // Navigate to link if provided
    if (notification.link) {
      navigate(notification.link);
    }
    
    // Close dropdown
    setIsOpen(false);
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (!user) return;
    
    await markAllNotificationsAsRead(user.id);
    
    // Update local state
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  // Delete notification
  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation(); // Prevent triggering notification click
    
    await deleteNotification(notificationId);
    
    // Update local state
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);
    setNotifications(updatedNotifications);
    
    // Update unread count if needed
    const deletedNotification = notifications.find(n => n.id === notificationId);
    if (deletedNotification && !deletedNotification.is_read) {
      setUnreadCount(Math.max(0, unreadCount - 1));
    }
  };

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payroll_processed':
      case 'payroll_deadline':
        return <DollarSign className="h-5 w-5 text-indigo-500" />;
      case 'leave_approved':
      case 'leave_rejected':
        return <Calendar className="h-5 w-5 text-green-500" />;
      case 'salary_change':
      case 'benefit_change':
        return <DollarSign className="h-5 w-5 text-yellow-500" />;
      case 'attendance_issue':
        return <Clock className="h-5 w-5 text-red-500" />;
      case 'system_update':
        return <Settings className="h-5 w-5 text-gray-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="relative flex-shrink-0 p-1 text-gray-400 rounded-full hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="sr-only">View notifications</span>
        <Bell className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-xs text-white text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-2">
            <div className="px-4 py-2 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="text-xs text-indigo-600 hover:text-indigo-900"
                  onClick={handleMarkAllAsRead}
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No notifications
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                      !notification.is_read ? 'bg-indigo-50' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                        <p className="text-sm text-gray-500">{notification.message}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <button
                        className="ml-2 text-gray-400 hover:text-gray-600"
                        onClick={(e) => handleDeleteNotification(e, notification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t border-gray-200 text-center">
              <button
                type="button"
                className="text-sm text-indigo-600 hover:text-indigo-900"
                onClick={() => {
                  navigate('/dashboard/notifications');
                  setIsOpen(false);
                }}
              >
                View all notifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}