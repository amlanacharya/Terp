import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Login } from './components/Auth/Login';
import { Dashboard } from './components/Dashboard/Dashboard';
import { LeadList } from './components/Leads/LeadList';
import { TripList } from './components/Trips/TripList';
import { DriverList } from './components/Drivers/DriverList';
import { VehicleList } from './components/Vehicles/VehicleList';
import { VehicleCategoryList } from './components/VehicleCategories/VehicleCategoryList';
import { RateChartList } from './components/RateCharts/RateChartList';
import { AnnexureListPage } from './components/Annexures/AnnexureListPage';
import { TaxComponentList } from './components/TaxConfig/TaxComponentList';
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
import { FirstRunWizard } from './components/Wizard/FirstRunWizard';
import { useAuth } from './contexts/AuthContext';
import { PageKey, CompanySettings } from './lib/types';

function AppContent() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');
  const [pageInstanceKey, setPageInstanceKey] = useState(0);
  const [pendingTripOpenId, setPendingTripOpenId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [isLoadingWizard, setIsLoadingWizard] = useState(true);

  // Check if wizard should be shown on app load
  useEffect(() => {
    const checkWizardStatus = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/license/company');
        if (response.status === 404) {
          // No company settings found - show wizard
          setShowWizard(true);
        } else if (response.ok) {
          // Company settings exist - don't show wizard
          setShowWizard(false);
        }
      } catch (error) {
        console.error('Failed to check wizard status:', error);
        // If server is not available, don't show wizard
        setShowWizard(false);
      } finally {
        setIsLoadingWizard(false);
      }
    };

    checkWizardStatus();
  }, []);

  const handleWizardComplete = () => {
    setShowWizard(false);
  };

  if (!user) {
    return <Login />;
  }

  // Show wizard if needed
  if (!isLoadingWizard && showWizard) {
    return <FirstRunWizard onComplete={handleWizardComplete} />;
  }

  // Show loading state while checking wizard status
  if (isLoadingWizard) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  function handleNavigate(page: PageKey) {
    if (page !== 'trips') {
      setPendingTripOpenId(null);
    }
    if (page !== currentPage) {
      setCurrentPage(page);
    }
    setPageInstanceKey((current) => current + 1);
  }

  function handleOpenTripFromAnnexures(tripId: string) {
    setPendingTripOpenId(tripId);
    setCurrentPage('trips');
    setPageInstanceKey((current) => current + 1);
  }

  function handleOpenTripFromInvoice(tripId: string) {
    setPendingTripOpenId(tripId);
    setCurrentPage('trips');
    setPageInstanceKey((current) => current + 1);
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'leads':
        return <ProtectedRoute><LeadList /></ProtectedRoute>;
      case 'trips':
        return <ProtectedRoute><TripList openTripId={pendingTripOpenId} openTripInEditor={Boolean(pendingTripOpenId)} onOpenTripHandled={() => setPendingTripOpenId(null)} /></ProtectedRoute>;
      case 'drivers':
        return <ProtectedRoute><DriverList /></ProtectedRoute>;
      case 'vehicles':
        return <ProtectedRoute><VehicleList /></ProtectedRoute>;
      case 'vehicle-categories':
        return <ProtectedRoute><VehicleCategoryList /></ProtectedRoute>;
      case 'rate-charts':
        return <ProtectedRoute><RateChartList /></ProtectedRoute>;
      case 'annexures':
        return <ProtectedRoute><AnnexureListPage onOpenTrip={handleOpenTripFromAnnexures} /></ProtectedRoute>;
      case 'tax-config':
        return <ProtectedRoute allowedRoles={['admin', 'accountant']}><TaxComponentList /></ProtectedRoute>;
      case 'customers':
        return <ProtectedRoute><CustomerList /></ProtectedRoute>;
      case 'owners':
        return <ProtectedRoute><OwnerList /></ProtectedRoute>;
      case 'invoices':
        return <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}><InvoiceList onNavigateToTrip={handleOpenTripFromInvoice} /></ProtectedRoute>;
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
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  const isDashboardPage = currentPage === 'dashboard';

  return (
    <div className="min-h-screen bg-slate-100">
      <Header onNavigate={handleNavigate} />
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 lg:px-6">
        <Sidebar onNavigate={handleNavigate} currentPage={currentPage} />
        <main className={isDashboardPage ? 'min-w-0 flex-1' : 'min-w-0 flex-1 rounded-3xl bg-white p-6 shadow-sm lg:p-8'}>
          <div key={`${currentPage}:${pageInstanceKey}`}>
            {renderContent()}
          </div>
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
