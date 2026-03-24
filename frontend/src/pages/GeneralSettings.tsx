import { Navigate } from 'react-router-dom';

export default function GeneralSettings() {
  return <Navigate to="/settings?tab=general" replace />;
}
