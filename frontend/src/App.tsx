import { Route, Routes } from 'react-router-dom'

import { RequireAuth } from './components/auth/RequireAuth'
// TODO: temporary — re-import RequireRole when restoring the process-economics editor gate
// import { RequireRole } from './components/auth/RequireRole'
import { Layout } from './components/Layout'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { CatalogPage } from './pages/CatalogPage'
import { ExecutivePage } from './pages/ExecutivePage'
import { HomePage } from './pages/HomePage'
import { IdeaDetailPage } from './pages/IdeaDetailPage'
import { IdeaWizardPage } from './pages/IdeaWizardPage'
import { IdeasPage } from './pages/IdeasPage'
import { ProcessEconomicsPage } from './pages/ProcessEconomicsPage'
import { SimpleOpsPage } from './pages/SimpleOpsPage'
import { SlaKpiPage } from './pages/SlaKpiPage'

export function App() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="executive" element={<ExecutivePage />} />
        <Route path="simple-ops" element={<SimpleOpsPage />} />
        <Route path="sla-kpi" element={<SlaKpiPage />} />
        <Route path="ideas" element={<IdeasPage />} />
        <Route element={<RequireAuth />}>
          <Route path="ideas/new" element={<IdeaWizardPage />} />
        </Route>
        {/* TODO: temporary — restore <RequireRole role="editor"> gate around this route */}
        <Route path="process-economics" element={<ProcessEconomicsPage />} />
        <Route path="ideas/:id" element={<IdeaDetailPage />} />
      </Route>
    </Routes>
  )
}
