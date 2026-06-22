import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Uploads from "./pages/Uploads";
import Assignments from "./pages/Assignments";
import Calendar from "./pages/Calendar";
import CompanyCalendar from "./pages/CompanyCalendar";
import Leaves from "./pages/Leaves";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import CreateAssignment from "./pages/CreateAssignment";
import Chat from "./pages/Chat";
import Email from "./pages/Email";
import CRM from "./pages/CRM";
import Social from "./pages/Social";
import AI from "./pages/AI";
import Support from "./pages/Support";
import Automations from "./pages/Automations";

const queryClient = new QueryClient();

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Loading…
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Loading />;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  let isAdminSession = false;
  try {
    const raw = localStorage.getItem("adminSession");
    isAdminSession = !!(raw && JSON.parse(raw)?.loggedIn);
  } catch {
    isAdminSession = false;
  }
  if (!isAdminSession) return <Navigate to="/admin-login" replace />;
  return <>{children}</>;
}

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/cofaczen" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/cofaczen/create-assignment" element={<AdminRoute><CreateAssignment /></AdminRoute>} />
            <Route path="/assignments" element={<ProtectedRoute><Assignments /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
            <Route path="/company-calendar" element={<ProtectedRoute><CompanyCalendar /></ProtectedRoute>} />
            <Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/email" element={<ProtectedRoute><Email /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/uploads" element={<ProtectedRoute><Uploads /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute><Automations /></ProtectedRoute>} />
            <Route path="/social" element={<ProtectedRoute><Social /></ProtectedRoute>} />
            <Route path="/ai" element={<ProtectedRoute><AI /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

export default App;
