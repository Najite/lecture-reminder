import React, { useEffect } from 'react';

const NotificationProcessor: React.FC = () => {
  useEffect(() => {
    // Process notifications every 30 seconds
    const processNotifications = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-notifications`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!response.ok) {
          console.error('Failed to process notifications:', await response.text());
        }
      } catch (error) {
        console.error('Error calling notification processor:', error);
      }
    };

    // Start processing immediately
    processNotifications();
    
    // Set up interval to process every 30 seconds
    const interval = setInterval(processNotifications, 30000);

    return () => clearInterval(interval);
  }, []);

  return null; // This component doesn't render anything
};

export default NotificationProcessor;