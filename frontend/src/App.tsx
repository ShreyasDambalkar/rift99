import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { RoleSelectPage } from './pages/RoleSelectPage';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { PatientDashboard } from './pages/PatientDashboard';
import { PublicPage } from './pages/PublicPage';
import { Loader2 } from 'lucide-react';

const AppContent = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-biotech-purple" />
          <p className="text-sm font-medium">Loading PharmaGuard...</p>
        </div>
      </div>
    );
  }

  if (user && !profile) return <RoleSelectPage />;
  if (user && profile?.role === 'doctor') return <DoctorDashboard />;
  if (user && profile?.role === 'patient') return <PatientDashboard />;

  return <PublicPage />;
};

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
