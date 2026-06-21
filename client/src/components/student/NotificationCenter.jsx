import { Bell } from 'lucide-react';
import { useState } from 'react';

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Mock Notifications for Automated Reminders and Availability Alerts
  const notifications = [
    { id: 1, type: 'alert', title: 'Book Available!', message: '"Clean Code" is now available to borrow.', time: '10 mins ago', read: false },
    { id: 2, type: 'reminder', title: 'Due Date Reminder', message: '"The Pragmatic Programmer" is due in 5 days.', time: '2 hours ago', read: false },
    { id: 3, type: 'system', title: 'Maintenance Notice', message: 'Library closed on Friday.', time: '1 day ago', read: true }
  ];

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors relative"
      >
        <Bell size={20} />
        {/* Unread Badge */}
        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger rounded-full border-2 border-white"></span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-900">Notifications</h3>
            <button className="text-xs text-indigo-600 font-medium hover:text-indigo-800">Mark all as read</button>
          </div>
          
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.map(notif => (
              <div key={notif.id} className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${!notif.read ? 'bg-indigo-50/30' : ''}`}>
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`text-sm ${!notif.read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{notif.title}</h4>
                  <span className="text-[10px] text-slate-500">{notif.time}</span>
                </div>
                <p className="text-xs text-slate-600">{notif.message}</p>
              </div>
            ))}
          </div>
          
          <div className="p-3 text-center border-t border-slate-100">
            <button className="text-sm text-slate-500 font-medium hover:text-slate-700">View all notifications</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
