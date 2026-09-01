import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import HomePage from './pages/Home/HomePage';
import ToolsPage from './pages/Tools/ToolsPage';
import TasksPage from './pages/Tasks/TasksPage';
import TaskDetailPage from './pages/TaskDetail/TaskDetailPage';
import ProfilePage from './pages/Profile/ProfilePage';
import RechargePage from './pages/Recharge/RechargePage';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="tools/:toolType" element={<ToolsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="recharge" element={<RechargePage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
