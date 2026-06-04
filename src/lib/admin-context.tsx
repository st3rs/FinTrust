import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';

interface AdminContextType {
  isAdmin: boolean | null;
  isChecking: boolean;
}

const AdminContext = createContext<AdminContextType>({ isAdmin: null, isChecking: true });

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Keep spinner visible while we re-check after session changes
    setIsChecking(true);

    if (!session?.access_token) {
      setIsAdmin(false);
      setIsChecking(false);
      return;
    }

    fetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => setIsAdmin(r.ok))
      .catch(() => setIsAdmin(false))
      .finally(() => setIsChecking(false));
  }, [session?.access_token]);

  return (
    <AdminContext.Provider value={{ isAdmin, isChecking }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
