import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import HomePage from './pages/Home/HomePage';
import ToolsPage from './pages/Tools/ToolsPage';
import TasksPage from './pages/Tasks/TasksPage';
import TaskDetailPage from './pages/TaskDetail/TaskDetailPage';
import ProfilePage from './pages/Profile/ProfilePage';
import RechargeUnavailablePage from './pages/Recharge/RechargeUnavailablePage';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import AuthCallbackPage from './pages/AuthCallback/AuthCallbackPage';
import KnowledgePage from './pages/Knowledge/KnowledgePage';
import AcademicSearchPage from './pages/AcademicSearch/AcademicSearchPage';
import ZoteroPage from './pages/Zotero/ZoteroPage';
import GroundedWritingPage from './pages/GroundedWriting/GroundedWritingPage';
import PapersPage from './pages/Papers/PapersPage';
import NewPaperPage from './pages/Papers/NewPaperPage';
import PaperWorkspacePage from './pages/Papers/PaperWorkspacePage';
import ManuscriptPage from './pages/Papers/ManuscriptPage';
import { AppAuthProvider } from './auth/AppAuthProvider';
import { RequireAuth } from './auth/RequireAuth';

const RoutesComponent = () => {
  return (
    <AppAuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route
            path="tools"
            element={
              <RequireAuth>
                <ToolsPage />
              </RequireAuth>
            }
          />
          <Route
            path="tools/:toolType"
            element={
              <RequireAuth>
                <ToolsPage />
              </RequireAuth>
            }
          />
          <Route
            path="tasks"
            element={
              <RequireAuth>
                <TasksPage />
              </RequireAuth>
            }
          />
          <Route
            path="tasks/:taskId"
            element={
              <RequireAuth>
                <TaskDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="knowledge"
            element={
              <RequireAuth>
                <KnowledgePage />
              </RequireAuth>
            }
          />
          <Route
            path="academic-search"
            element={
              <RequireAuth>
                <AcademicSearchPage />
              </RequireAuth>
            }
          />
          <Route
            path="zotero"
            element={
              <RequireAuth>
                <ZoteroPage />
              </RequireAuth>
            }
          />
          <Route
            path="grounded-writing"
            element={
              <RequireAuth>
                <GroundedWritingPage />
              </RequireAuth>
            }
          />
          <Route
            path="papers"
            element={<RequireAuth><PapersPage /></RequireAuth>}
          />
          <Route
            path="papers/new"
            element={<RequireAuth><NewPaperPage /></RequireAuth>}
          />
          <Route
            path="papers/:projectId"
            element={<RequireAuth><PaperWorkspacePage /></RequireAuth>}
          />
          <Route
            path="papers/:projectId/manuscript"
            element={<RequireAuth><ManuscriptPage /></RequireAuth>}
          />
          <Route
            path="profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="recharge"
            element={
              <RequireAuth>
                <RechargeUnavailablePage />
              </RequireAuth>
            }
          />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppAuthProvider>
  );
};

export default RoutesComponent;
