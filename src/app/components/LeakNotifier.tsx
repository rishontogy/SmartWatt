import { useEffect } from 'react';
import { alertsAPI } from '@/app/lib/api';
import { useAuth } from '@/app/contexts/auth-context';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';

export function LeakNotifier() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const checkAlerts = async () => {
      try {
        const unreadAlerts = await alertsAPI.getUnreadAlerts();
        
        unreadAlerts.forEach((alert: any) => {
          toast.error(
             <div className="flex flex-col gap-1">
               <div className="flex items-center gap-2 font-bold">
                 <Activity className="w-5 h-5" />
                 Leak Alert
               </div>
               <span>{alert.message}</span>
             </div>,
             {
               duration: 10000,
               onDismiss: () => alertsAPI.markAsRead(alert.id),
               onAutoClose: () => alertsAPI.markAsRead(alert.id)
             }
          );
        });
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
      }
    };

    // Check immediately on mount, then every 30 seconds
    checkAlerts();
    const interval = setInterval(checkAlerts, 30000);

    return () => clearInterval(interval);
  }, [user]);

  return null; // This component doesn't render anything directly
}
