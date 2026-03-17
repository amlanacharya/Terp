import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Login } from './components/Auth/Login';
import { Dashboard } from './components/Dashboard/Dashboard';
import { LeadList } from './components/Leads/LeadList';
import { TripList } from './components/Trips/TripList';
import { DriverList } from './components/Drivers/DriverList';
import { VehicleList } from './components/Vehicles/VehicleList';
import { VehicleCategoryList } from './components/VehicleCategories/VehicleCategoryList';
import { CustomerList } from './components/Customers/CustomerList';
import { InvoiceList } from './components/Invoices/InvoiceList';
import { CollectionList } from './components/Collections/CollectionList';
import { OwnerList } from './components/Owners/OwnerList';
import { DriverSettlements } from './components/Settlements/DriverSettlements';
import { OwnerSettlements } from './components/Settlements/OwnerSettlements';
import { Reports } from './components/Reports/Reports';
import { Settings } from './components/Settings/Settings';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { useAuth } from './contexts/AuthContext';
import { PageKey } from './lib/types';

function AppContent() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'leads':
        return <ProtectedRoute><LeadList /></ProtectedRoute>;
      case 'trips':
        return <ProtectedRoute><TripList /></ProtectedRoute>;
      case 'drivers':
        return <ProtectedRoute><DriverList /></ProtectedRoute>;
      case 'vehicles':
        return <ProtectedRoute><VehicleList /></ProtectedRoute>;
      case 'vehicle-categories':
        return <ProtectedRoute><VehicleCategoryList /></ProtectedRoute>;
      case 'customers':
        return <ProtectedRoute><CustomerList /></ProtectedRoute>;
      case 'owners':
        return <ProtectedRoute><OwnerList /></ProtectedRoute>;
      case 'invoices':
        return <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}><InvoiceList /></ProtectedRoute>;
      case 'collections':
        return <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}><CollectionList /></ProtectedRoute>;
      case 'driver-settlements':
        return <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}><DriverSettlements /></ProtectedRoute>;
      case 'owner-settlements':
        return <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}><OwnerSettlements /></ProtectedRoute>;
      case 'reports':
        return <ProtectedRoute><Reports /></ProtectedRoute>;
      case 'settings':
        return <ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Header onNavigate={setCurrentPage} />
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 lg:px-6">
        <Sidebar onNavigate={setCurrentPage} currentPage={currentPage} />
        <main className="min-w-0 flex-1 rounded-3xl bg-white p-6 shadow-sm lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
