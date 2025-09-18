// utils/sessionManager.js

class SessionManager {
  constructor() {
    this.tabId = Date.now() + Math.random();
    this.initSession();
  }

  initSession() {
    // Thêm tab ID vào danh sách tabs đang hoạt động
    const activeTabs = JSON.parse(localStorage.getItem('activeTabs') || '[]');
    activeTabs.push(this.tabId);
    localStorage.setItem('activeTabs', JSON.stringify(activeTabs));

    // Lắng nghe khi tab đóng
    window.addEventListener('beforeunload', () => {
      this.removeTab();
    });

    // Lắng nghe khi focus vào tab
    window.addEventListener('focus', () => {
      this.checkSession();
    });

    // Check định kỳ xem còn tabs nào hoạt động không
    setInterval(() => {
      this.cleanupInactiveTabs();
    }, 5000);
  }

  removeTab() {
    const activeTabs = JSON.parse(localStorage.getItem('activeTabs') || '[]');
    const updatedTabs = activeTabs.filter(id => id !== this.tabId);
    localStorage.setItem('activeTabs', JSON.stringify(updatedTabs));

    // Nếu không còn tab nào hoạt động -> logout
    if (updatedTabs.length === 0) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('activeTabs');
    }
  }

  checkSession() {
    const token = localStorage.getItem('token');
    const activeTabs = JSON.parse(localStorage.getItem('activeTabs') || '[]');
    
    // Nếu không có token nhưng có tabs active -> đã bị logout
    if (!token && activeTabs.length > 0) {
      localStorage.removeItem('activeTabs');
      window.location.reload();
    }
  }

  cleanupInactiveTabs() {
    // Đây là function đơn giản, trong thực tế có thể phức tạp hơn
    const activeTabs = JSON.parse(localStorage.getItem('activeTabs') || '[]');
    if (activeTabs.length === 0) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
}

// Export singleton instance
const sessionManager = new SessionManager();
export default sessionManager;

// Cách sử dụng trong App.js:
/*
import sessionManager from './utils/sessionManager';

function App() {
  // sessionManager sẽ tự động khởi tạo khi import
  return (
    <div className="App">
      // Nội dung app
    </div>
  );
}
*/