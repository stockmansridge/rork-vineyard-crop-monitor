import { describe, it, expect } from 'bun:test';
import { roleHas, type Capability, type ShareRole } from '@/lib/permissions';

/**
 * Permission QA matrix.
 *
 * Verifies every role × action combination resolves the way the product spec
 * requires. If the ROLE_CAPABILITIES map drifts (or a new capability is added
 * without being mapped), this suite fails and forces an explicit decision.
 *
 * The matrix is the source of truth shared with the backend (RLS helpers in
 * supabase-schema.sql: user_can_edit_vineyard / user_can_create_records /
 * user_can_delete_records). Any change here must be mirrored there.
 */

type Expectation = Partial<Record<ShareRole, boolean>>;

const MATRIX: { action: string; capability: Capability; expect: Expectation }[] = [
  // scout tasks
  {
    action: 'create scout task',
    capability: 'scout.create',
    expect: { owner: true, manager: true, worker: false, viewer: false },
  },
  {
    action: 'complete / resolve scout task',
    capability: 'scout.resolve',
    expect: { owner: true, manager: true, worker: true, viewer: false },
  },
  {
    action: 'delete scout task',
    capability: 'scout.delete',
    expect: { owner: true, manager: false, worker: false, viewer: false },
  },

  // observations
  {
    action: 'create observation / photo / pin',
    capability: 'observations.create',
    expect: { owner: true, manager: true, worker: true, viewer: false },
  },

  // records (vineyard tasks / sprays / harvests / phenology)
  {
    action: 'create record',
    capability: 'records.create',
    expect: { owner: true, manager: true, worker: true, viewer: false },
  },
  {
    action: 'edit record',
    capability: 'records.edit',
    expect: { owner: true, manager: true, worker: false, viewer: false },
  },
  {
    action: 'delete record',
    capability: 'records.delete',
    expect: { owner: true, manager: true, worker: false, viewer: false },
  },

  // block / agronomy / vineyard settings
  {
    action: 'edit block / agronomy profile',
    capability: 'vineyard.edit',
    expect: { owner: true, manager: true, worker: false, viewer: false },
  },
  {
    action: 'edit irrigation / agronomy settings',
    capability: 'vineyard.manageSettings',
    expect: { owner: true, manager: true, worker: false, viewer: false },
  },
  {
    action: 'delete vineyard / core record',
    capability: 'vineyard.delete',
    expect: { owner: true, manager: false, worker: false, viewer: false },
  },

  // collaboration / admin
  {
    action: 'manage users / sharing',
    capability: 'vineyard.manageUsers',
    expect: { owner: true, manager: false, worker: false, viewer: false },
  },
  {
    action: 'manage billing / integrations',
    capability: 'vineyard.manageBilling',
    expect: { owner: true, manager: false, worker: false, viewer: false },
  },
  {
    action: 'export reports',
    capability: 'vineyard.exportReports',
    expect: { owner: true, manager: true, worker: false, viewer: false },
  },

  // recommendation acknowledgements
  {
    action: 'acknowledge recommendation',
    capability: 'recommendations.acknowledge',
    expect: { owner: true, manager: true, worker: false, viewer: false },
  },
];

const ALL_ROLES: ShareRole[] = ['owner', 'manager', 'worker', 'viewer'];

describe('permissions QA matrix — role × action', () => {
  for (const row of MATRIX) {
    describe(`${row.action} (${row.capability})`, () => {
      for (const role of ALL_ROLES) {
        const expected = row.expect[role] ?? false;
        it(`${role} → ${expected ? 'allowed' : 'denied'}`, () => {
          expect(roleHas(role, row.capability)).toBe(expected);
        });
      }
    });
  }

  it('viewer has no capabilities at all', () => {
    const caps: Capability[] = [
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
    ];
    for (const c of caps) {
      expect(roleHas('viewer', c)).toBe(false);
    }
  });

  it('null role (no share) has no capabilities', () => {
    expect(roleHas(null, 'records.create')).toBe(false);
    expect(roleHas(null, 'scout.resolve')).toBe(false);
    expect(roleHas(undefined, 'vineyard.edit')).toBe(false);
  });

  it('owner has every declared capability', () => {
    const every = MATRIX.map((r) => r.capability);
    for (const c of every) {
      expect(roleHas('owner', c)).toBe(true);
    }
  });

  it('worker cannot edit or delete records (no silent escalation)', () => {
    expect(roleHas('worker', 'records.edit')).toBe(false);
    expect(roleHas('worker', 'records.delete')).toBe(false);
    expect(roleHas('worker', 'vineyard.edit')).toBe(false);
    expect(roleHas('worker', 'vineyard.manageSettings')).toBe(false);
    expect(roleHas('worker', 'vineyard.manageUsers')).toBe(false);
    expect(roleHas('worker', 'vineyard.delete')).toBe(false);
    expect(roleHas('worker', 'vineyard.exportReports')).toBe(false);
    expect(roleHas('worker', 'scout.create')).toBe(false);
    expect(roleHas('worker', 'scout.delete')).toBe(false);
    expect(roleHas('worker', 'recommendations.acknowledge')).toBe(false);
  });

  it('manager cannot delete vineyard, manage users or billing', () => {
    expect(roleHas('manager', 'vineyard.delete')).toBe(false);
    expect(roleHas('manager', 'vineyard.manageUsers')).toBe(false);
    expect(roleHas('manager', 'vineyard.manageBilling')).toBe(false);
    expect(roleHas('manager', 'scout.delete')).toBe(false);
  });
});

describe('permissions QA matrix — UI/backend contract', () => {
  /**
   * These checks protect the UI↔RLS contract. The Supabase helpers are:
   *   user_can_edit_vineyard   → owner, manager
   *   user_can_create_records  → owner, manager, worker
   *   user_can_delete_records  → owner, manager
   * UI capabilities must map onto exactly those sets.
   */

  const editSet: ShareRole[] = ['owner', 'manager'];
  const createSet: ShareRole[] = ['owner', 'manager', 'worker'];
  const deleteSet: ShareRole[] = ['owner', 'manager'];

  it('records.create mirrors user_can_create_records', () => {
    for (const r of ALL_ROLES) {
      expect(roleHas(r, 'records.create')).toBe(createSet.includes(r));
    }
  });

  it('records.edit mirrors user_can_edit_vineyard', () => {
    for (const r of ALL_ROLES) {
      expect(roleHas(r, 'records.edit')).toBe(editSet.includes(r));
    }
  });

  it('records.delete mirrors user_can_delete_records', () => {
    for (const r of ALL_ROLES) {
      expect(roleHas(r, 'records.delete')).toBe(deleteSet.includes(r));
    }
  });

  it('vineyard.edit and vineyard.manageSettings mirror user_can_edit_vineyard', () => {
    for (const r of ALL_ROLES) {
      expect(roleHas(r, 'vineyard.edit')).toBe(editSet.includes(r));
      expect(roleHas(r, 'vineyard.manageSettings')).toBe(editSet.includes(r));
    }
  });

  it('scout.create must not exceed edit set (cannot be granted to worker)', () => {
    for (const r of ALL_ROLES) {
      if (roleHas(r, 'scout.create')) {
        expect(editSet.includes(r)).toBe(true);
      }
    }
  });

  it('scout.delete must not exceed the vineyard delete set', () => {
    for (const r of ALL_ROLES) {
      if (roleHas(r, 'scout.delete')) {
        expect(r).toBe('owner');
      }
    }
  });
});
