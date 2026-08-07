import { Route, Routes } from 'react-router-dom'

import { Layout } from './components/Layout'
import { CatalogPage } from './pages/CatalogPage'
import { ExecutivePage } from './pages/ExecutivePage'
import { HomePage } from './pages/HomePage'
import { ItemsPage } from './pages/ItemsPage'
import { OperationsPage } from './pages/OperationsPage'
import { RoiPage } from './pages/RoiPage'
import { ServicePerformancePage } from './pages/ServicePerformancePage'
import { SimpleOpsPage } from './pages/SimpleOpsPage'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="executive" element={<ExecutivePage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="simple-ops" element={<SimpleOpsPage />} />
        <Route path="roi" element={<RoiPage />} />
        <Route
          path="service-performance"
          element={<ServicePerformancePage />}
        />
      </Route>
    </Routes>
  )
}
