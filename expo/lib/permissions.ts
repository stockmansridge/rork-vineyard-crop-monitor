export type ShareRole = 'owner' | 'manager' | 'worker' | 'viewer';

export type Capability =
  | 'vineyard.delete'
  | 'vineyard.edit'
  | 'vineyard.manageUsers'
  | 'vineyard.manageSettings'
  | 'vineyard.exportReports'
  | 'vineyard.manageBilling'
  | 'records.create'
  | 'records.edit'
  | 'records.delete'
  | 'scout.create'
  | 'scout.resolve'
  | 'scout.delete'
  | 'recommendations.acknowledge'
  | 'observations.create';

export const ROLE_CAPABILITIES: Record<ShareRole, Capability[]> = {
  owner: [
    'vineyard.delete',
    'vineyard.edit',
    'vineyard.manageUsers',
    'vineyard.manageSettings',
    'vineyard.exportReports',
    'vineyard.manageBilling',
    'records.create',
    'records.edit',
    'records.delete',
    'scout.create',
    'scout.resolve',
    'scout.delete',
    'recommendations.acknowledge',
    'observations.create',
  ],
  manager: [
    'vineyard.edit',
    'vineyard.manageSettings',
    'vineyard.exportReports',
    'records.create',
    'records.edit',
    'records.delete',
    'scout.create',
    'scout.resolve',
    'recommendations.acknowledge',
    'observations.create',
  ],
  worker: [
    'records.create',
    'scout.resolve',
    'observations.create',
  ],
  viewer: [],
};

export function roleHas(
  role: ShareRole | null | undefined,
  capability: Capability
): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function roleLabel(role: ShareRole | null | undefined): string {
  switch (role) {
    case 'owner': return 'Owner';
    case 'manager': return 'Manager';
    case 'worker': return 'Worker';
    case 'viewer': return 'Viewer';
    default: return 'Unknown';
  }
}
