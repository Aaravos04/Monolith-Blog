import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import BlogDetail from './pages/BlogDetail';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import PublicProfile from './pages/PublicProfile';
import Register from './pages/Register';
import Search from './pages/Search';
import Write from './pages/Write';

const App = () => (
  <Routes>
    {/* Every page shares the navbar and footer from Layout */}
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="search" element={<Search />} />
      <Route path="blogs/:id" element={<BlogDetail />} />
      <Route path="users/:username" element={<PublicProfile />} />

      <Route
        path="write"
        element={
          <ProtectedRoute>
            <Write />
          </ProtectedRoute>
        }
      />
      <Route
        path="write/:id"
        element={
          <ProtectedRoute>
            <Write />
          </ProtectedRoute>
        }
      />
      <Route
        path="dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);

export default App;
