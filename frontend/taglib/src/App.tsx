import { Routes, Route } from 'react-router';
import { DataProvider } from '@/context/DataContext';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import AtomicTagsPage from '@/pages/AtomicTagsPage';
import TagSystemsPage from '@/pages/TagSystemsPage';
import TagSystemEditorPage from '@/pages/TagSystemEditorPage';
import SyncTrackingPage from '@/pages/SyncTrackingPage';
import UsersPage from '@/pages/UsersPage';
import PermissionsPage from '@/pages/PermissionsPage';

export default function App() {
  return (
    <DataProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/atomic-tags" element={<AtomicTagsPage />} />
          <Route path="/tag-systems" element={<TagSystemsPage />} />
          <Route path="/tag-system-editor/:id" element={<TagSystemEditorPage />} />
          <Route path="/sync-tracking" element={<SyncTrackingPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/permissions" element={<PermissionsPage />} />
        </Routes>
      </Layout>
    </DataProvider>
  );
}
