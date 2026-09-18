import { useState } from 'react';
import ProfileSidebar, { type ProfileTab } from './ProfileSidebar';
import Dashboard from './pages/Dashboard';
import MyTasks from './pages/MyTasks';
import Orders from './pages/Orders';
import PointRecords from './pages/PointRecords';
import Settings from './pages/Settings';
import Integrations from './pages/Integrations';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'tasks':
        return <MyTasks />;
      case 'orders':
        return <Orders />;
      case 'records':
        return <PointRecords />;
      case 'settings':
        return <Settings />;
      case 'integrations':
        return <Integrations />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      <ProfileSidebar active={activeTab} onChange={setActiveTab} />
      <div className="flex-1 p-6 overflow-auto">{renderContent()}</div>
    </div>
  );
}
