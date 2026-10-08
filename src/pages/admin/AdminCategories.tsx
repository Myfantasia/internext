import React from 'react';
import { CatalogEntityPage } from './CatalogEntityPage';

export const AdminCategories: React.FC<{ onNavigate?: (tab: string, params?: Record<string, string>) => void }> = ({ onNavigate }) => (
  <CatalogEntityPage kind="category" onNavigate={onNavigate} />
);
