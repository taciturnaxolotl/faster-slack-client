export function formatMessageTime(ts: string | number): string {
    const date = new Date(typeof ts === 'string' ? parseInt(ts) * 1000 : ts * 1000);
    const now = new Date();
    
    const isToday = date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
      
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    
    const isYesterday = date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();
      
    const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    
    if (isToday) {
      return timeString;
    } else if (isYesterday) {
      return `Yesterday at ${timeString}`;
    } else {
      const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `${dateString} at ${timeString}`;
    }
  }