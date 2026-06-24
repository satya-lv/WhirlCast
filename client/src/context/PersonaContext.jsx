import React, { createContext, useContext, useState } from 'react';

// Hardcoded lock values derived from the DB:
//   Mumbai: location_id = 1 in both modules (locations table)
//   AC: sku_family = 'Air Conditioner' in both modules
const LOCK_DEFS = {
  branch_manager: {
    demand: { field: 'locationId', value: '1', label: 'Mumbai' },
    supply: { field: 'locationId', value: '1', label: 'Mumbai' },
  },
  category_manager: {
    demand: { field: 'skuFamily', value: 'Air Conditioner', label: 'Air Conditioner' },
    supply: { field: 'skuFamily', value: 'Air Conditioner', label: 'Air Conditioner' },
  },
};

// Returns { field, value, label } or null.
// Call this inside module pages: getLockedFilter(persona?.role, 'demand' | 'supply')
export function getLockedFilter(role, module) {
  return LOCK_DEFS[role]?.[module] ?? null;
}

const PersonaContext = createContext(null);

export function PersonaProvider({ children }) {
  // persona shape: { displayName, initial, role, module } | null
  // role: null | 'planner' | 'branch_manager' | 'category_manager'
  // module: null | 'demand' | 'supply'
  const [persona, setPersonaState] = useState(null);

  const setPersona = (patch) =>
    setPersonaState(prev => prev ? { ...prev, ...patch } : patch);

  const clearPersona = () => setPersonaState(null);

  return (
    <PersonaContext.Provider value={{ persona, setPersona, clearPersona }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  return useContext(PersonaContext);
}
