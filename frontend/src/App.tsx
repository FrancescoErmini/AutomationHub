import { Route, Routes } from 'react-router-dom'

import { RequireAuth } from './components/auth/RequireAuth'
import { RequireRole } from './components/auth/RequireRole'
import { Layout } from './components/Layout'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { CatalogPage } from './pages/CatalogPage'
import { ExecutivePage } from './pages/ExecutivePage'
import { HomePage } from './pages/HomePage'
import { IdeaDetailPage } from './pages/IdeaDetailPage'
import { IdeaWizardPage } from './pages/IdeaWizardPage'
import { IdeasPage } from './pages/IdeasPage'
import { ItemsPage } from './pages/ItemsPage'
import { OperationsPage } from './pages/OperationsPage'
import { ProcessEconomicsPage } from './pages/ProcessEconomicsPage'
import { ServicePerformancePage } from './pages/ServicePerformancePage'
import { SimpleOpsPage } from './pages/SimpleOpsPage'
import { SlaKpiPage } from './pages/SlaKpiPage'

export function App() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="executive" element={<ExecutivePage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="simple-ops" element={<SimpleOpsPage />} />
        <Route path="sla-kpi" element={<SlaKpiPage />} />
        <Route
          path="service-performance"
          element={<ServicePerformancePage />}
        />
        <Route path="ideas" element={<IdeasPage />} />
        <Route element={<RequireAuth />}>
          <Route path="ideas/new" element={<IdeaWizardPage />} />
        </Route>
        <Route element={<RequireRole role="editor" />}>
          <Route path="process-economics" element={<ProcessEconomicsPage />} />
        </Route>
        <Route path="ideas/:id" element={<IdeaDetailPage />} />
      </Route>
    </Routes>
  )
}
