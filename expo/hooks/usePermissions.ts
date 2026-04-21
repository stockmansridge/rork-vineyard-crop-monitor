import { useCallback, useMemo } from 'react';
import { useVineyards, type Capability, type ShareRole } from '@/providers/VineyardProvider';

export interface VineyardPermissions {
  role: ShareRole | null;
  isOwner: boolean;
  isManager: boolean;
  isWorker: boolean;
  isViewer: boolean;
  isReadOnly: boolean;
  can: (capability: Capability) => boolean;
  // common shortcuts
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canExport: boolean;
  canCreateRecord: boolean;
  canEditRecord: boolean;
  canDeleteRecord: boolean;
  canResolveScout: boolean;
  canAcknowledge: boolean;
}

export function useVineyardPermissions(vineyardId: string | null | undefined): VineyardPermissions {
  const { getUserRole, canOnVineyard } = useVineyards();
  const role = vineyardId ? getUserRole(vineyardId) : null;

  const can = useCallback(
    (cap: Capability) => (vineyardId ? canOnVineyard(vineyardId, cap) : false),
    [canOnVineyard, vineyardId]
  );

  return useMemo<VineyardPermissions>(
    () => ({
      role,
      isOwner: role === 'owner',
      isManager: role === 'manager',
      isWorker: role === 'worker',
      isViewer: role === 'viewer',
      isReadOnly: role === 'viewer' || role === null,
      can,
      canEdit: can('vineyard.edit'),
      canDelete: can('vineyard.delete'),
      canManageUsers: can('vineyard.manageUsers'),
      canManageSettings: can('vineyard.manageSettings'),
      canExport: can('vineyard.exportReports'),
      canCreateRecord: can('records.create'),
      canEditRecord: can('records.edit'),
      canDeleteRecord: can('records.delete'),
      canResolveScout: can('scout.resolve'),
      canAcknowledge: can('recommendations.acknowledge'),
    }),
    [role, can]
  );
}
