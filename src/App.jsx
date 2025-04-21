import React from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/HomePage.jsx'
import CampaignsPage from './pages/CampaignsPage'
import LoginPage from './pages/LoginPage'
import AuthSuccessPage from './pages/AuthCallbackPage.jsx'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
        </Route>
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/success" element={<AuthSuccessPage />} />
    </Routes>
  )
}

export default App
