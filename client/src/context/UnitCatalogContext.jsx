import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import settingsService from '../services/settingsService';
import { getUnitCategories, mergeUnitCatalog } from '../constants/units';
import { getApiErrorMessage } from '../utils/apiErrors';

const DEFAULT_UNITS = mergeUnitCatalog();
const UnitCatalogContext = createContext({ units: DEFAULT_UNITS, categories: getUnitCategories(DEFAULT_UNITS), loading: false, error: '' });

export const UnitCatalogProvider = ({ children }) => {
  const [definitions, setDefinitions] = useState(DEFAULT_UNITS);
  const [registeredCategories, setRegisteredCategories] = useState(undefined);
  const categories = useMemo(() => getUnitCategories(definitions, registeredCategories), [definitions, registeredCategories]);
  const units = useMemo(() => definitions.filter((unit) => !unit.deleted).map((unit) => ({
    ...unit, category: categories.find((name) => name.toLowerCase() === unit.category.toLowerCase()) || unit.category,
  })), [definitions, categories]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    settingsService.getSettingsGroup('catalog').then((settings) => {
      if (active) {
        setDefinitions(mergeUnitCatalog(settings?.unitCatalog, { includeDeleted: true }));
        setRegisteredCategories(settings?.unitCategories);
      }
    }).catch((err) => {
      if (active) setError(getApiErrorMessage(err, 'Could not load custom units.'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [revision]);

  const retry = useCallback(() => setRevision((current) => current + 1), []);
  const saveUnits = useCallback(async (nextUnits) => {
    const incoming = new Set(nextUnits.map((unit) => unit.value.toLowerCase()));
    // Retain deletion markers so built-in units do not reappear after reload
    // or when another unit is edited. Explicitly adding a symbol restores it.
    const next = [...definitions.filter((unit) => unit.deleted && !incoming.has(unit.value.toLowerCase())), ...nextUnits];
    await settingsService.updateSingleSetting('unitCatalog', next, 'catalog');
    setDefinitions(mergeUnitCatalog(next, { includeDeleted: true }));
  }, [definitions]);
  const saveCategories = useCallback(async (nextCategories, nextUnits) => {
    if (!nextUnits) {
      // Empty-category deletion must check the server's current catalog,
      // without replacing unit assignments with a potentially stale snapshot.
      await settingsService.updateSingleSetting('unitCategories', nextCategories, 'catalog');
      setRegisteredCategories(nextCategories);
      return;
    }
    const incoming = new Set(nextUnits.map((unit) => unit.value.toLowerCase()));
    const next = [...definitions.filter((unit) => unit.deleted && !incoming.has(unit.value.toLowerCase())), ...nextUnits];
    // Rename categories and their unit assignments in the same transaction.
    await settingsService.updateSettingsBulk([
      { key: 'unitCategories', value: nextCategories, group: 'catalog' },
      { key: 'unitCatalog', value: next, group: 'catalog' },
    ]);
    setRegisteredCategories(nextCategories);
    setDefinitions(mergeUnitCatalog(next, { includeDeleted: true }));
  }, [definitions]);
  const value = useMemo(() => ({ units, categories, loading, error, retry, saveUnits, saveCategories }), [units, categories, loading, error, retry, saveUnits, saveCategories]);
  return <UnitCatalogContext.Provider value={value}>{children}</UnitCatalogContext.Provider>;
};

export const useUnitCatalog = () => useContext(UnitCatalogContext);
