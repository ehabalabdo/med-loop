import React, { createContext, useContext, useEffect, useState } from 'react';
import { Client } from '../types';
import sql from '../services/db';

interface ClientContextType {
  client: Client | null;
  loading: boolean;
  error: string | null;
  isExpired: boolean;
  isReadOnly: boolean;
  refreshClient: () => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

// Extract slug from URL: med.loopjo.com/alshifa → "alshifa"
// Or from hash: /#/alshifa/login → "alshifa"
function getSlugFromURL(): string | null {
  // Check hash route first: /#/alshifa/login
  const hash = window.location.hash;
  if (hash) {
    const parts = hash.replace('#/', '').split('/');
    if (parts[0] && parts[0] !== 'super-admin' && parts[0] !== 'login') {
      return parts[0];
    }
  }
  
  // Check path: /alshifa
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  if (parts[0] && parts[0] !== 'super-admin') {
    return parts[0];
  }
  
  // Check localStorage fallback
  const saved = localStorage.getItem('currentClientSlug');
  if (saved) return saved;
  
  return null;
}

async function fetchClientBySlug(slug: string): Promise<Client | null> {
  try {
    const result = await sql`
      SELECT * FROM clients WHERE slug = ${slug} AND is_active = true LIMIT 1
    `;
    if (result.length === 0) return null;
    
    const row = result[0] as any;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      status: row.status,
      trialEndsAt: row.trial_ends_at,
      subscriptionEndsAt: row.subscription_ends_at,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active
    };
  } catch (err) {
    console.error('[ClientContext] Error fetching client:', err);
    return null;
  }
}

function checkExpiration(client: Client): boolean {
  const now = new Date();
  
  if (client.status === 'suspended') return true;
  if (client.status === 'expired') return true;
  
  if (client.status === 'trial' && client.trialEndsAt) {
    return new Date(client.trialEndsAt) < now;
  }
  
  if (client.status === 'active' && client.subscriptionEndsAt) {
    return new Date(client.subscriptionEndsAt) < now;
  }
  
  return false;
}

export const ClientProvider: React.FC<{ children: React.ReactNode; slug?: string }> = ({ children, slug: propSlug }) => {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClient = async () => {
    const slug = propSlug || getSlugFromURL();
    if (!slug) {
      setLoading(false);
      return;
    }

    try {
      const c = await fetchClientBySlug(slug);
      if (c) {
        setClient(c);
        localStorage.setItem('currentClientSlug', slug);
        localStorage.setItem('currentClientId', String(c.id));
      } else {
        setError('هذا المركز غير موجود');
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في تحميل بيانات المركز');
    } finally {
      setLoading(false);
    }
  };

  const refreshClient = async () => {
    await loadClient();
  };

  useEffect(() => {
    loadClient();
  }, [propSlug]);

  const isExpired = client ? checkExpiration(client) : false;
  const isReadOnly = isExpired; // expired = read only

  return (
    <ClientContext.Provider value={{ client, loading, error, isExpired, isReadOnly, refreshClient }}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = () => {
  const context = useContext(ClientContext);
  if (!context) throw new Error('useClient must be used within a ClientProvider');
  return context;
};

// Helper to get current client_id from anywhere
export function getCurrentClientId(): number | null {
  const saved = localStorage.getItem('currentClientId');
  return saved ? parseInt(saved) : null;
}
