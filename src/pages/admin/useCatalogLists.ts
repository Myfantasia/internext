import { useCallback, useEffect, useState } from 'react';
import { Brand, Category } from '../../types';
import { api } from './adminUi';

// Raw API rows (DB column names), not the storefront-mapped shapes.
export type AdminCategory = Partial<Category> & { id: string; name: string; slug: string; description?: string | null; imageUrl?: string | null; productCount?: number; kind?: 'product' | 'service'; sortOrder?: number };
export type AdminBrand = Partial<Brand> & { id: string; name: string; slug?: string; description?: string | null; logoUrl?: string | null; count?: number };

// Raw category/brand rows for admin screens (DB field names, with counts).
export function useCatalogLists() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');
    try {
      const [c, b] = await Promise.all([
        api<{ categories: AdminCategory[] }>('/api/categories'),
        api<{ brands: AdminBrand[] }>('/api/brands')
      ]);
      setCategories(c.categories);
      setBrands(b.brands);
    } catch (e: any) {
      setError(e.message || 'Could not load categories and brands');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { categories, brands, loading, error, reload };
}
