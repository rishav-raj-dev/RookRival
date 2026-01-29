'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';
import { useAuthStore } from '@/store';

export function useAuthCheck() {
  const { user, setUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // Skip auth check for public pages
      if (pathname === '/login' || pathname === '/signup') {
        setIsLoading(false);
        setIsChecked(true);
        return;
      }

      // If user already exists in store from localStorage, skip API check
      if (user && !isChecked) {
        setIsLoading(false);
        setIsChecked(true);
        return;
      }

      // Only make API call if we haven't checked yet and user is not in store
      if (!isChecked) {
        try {
          const response = await axios.get('/api/auth/me');
          if (response.data.success) {
            setUser(response.data.data.user);
          } else {
            setUser(null);
            if (pathname !== '/login' && pathname !== '/signup') {
              router.push('/login');
            }
          }
        } catch (error) {
          setUser(null);
          if (pathname !== '/login' && pathname !== '/signup') {
            router.push('/login');
          }
        } finally {
          setIsLoading(false);
          setIsChecked(true);
        }
      }
    };

    checkAuth();
  }, [pathname, router, setUser, user, isChecked]);

  return { user, isAuthenticated: !!user, isLoading };
}
