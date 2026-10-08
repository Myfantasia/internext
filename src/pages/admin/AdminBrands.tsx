import React from 'react';
import { CatalogEntityPage } from './CatalogEntityPage';

export const AdminBrands: React.FC<{ onNavigate?: (tab: string, params?: Record<string, string>) => void }> = ({ onNavigate }) => (
  <CatalogEntityPage kind="brand" onNavigate={onNavigate} />
);
