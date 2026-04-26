import { Routes, Route, Navigate } from 'react-router';
import { DataProvider } from '@/context/DataContext';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import TagSystemsPage from '@/pages/TagSystemsPage';
import TagSystemEditorPage from '@/pages/TagSystemEditorPage';
import AtomicTagsPage from '@/pages/AtomicTagsPage';

export default function App() {
  return (
    <DataProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tag-systems" element={<TagSystemsPage />} />
          <Route path="/tag-system-editor/:id" element={<TagSystemEditorPage />} />
          <Route path="/atomic-tags" element={<AtomicTagsPage />} />
        </Routes>
      </Layout>
    </DataProvider>
  );
}
