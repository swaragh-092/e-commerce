import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaService } from '../services/mediaService';
import { IMAGE_PRESETS } from '../utils/imageEditing';

const CHANGE_EVENT = 'media:crop-presets-changed';
export default function useCropPresets() {
  const [custom, setCustom] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(null);
  const reload = useCallback(async () => {
    if (typeof mediaService.listCropPresets !== 'function') return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const response = await mediaService.listCropPresets(controller.signal);
      if (!controller.signal.aborted) { setCustom(response.data || []); setError(''); }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.response?.data?.error?.message || 'Could not load custom presets. Built-in presets still work.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener('focus', reload);
    return () => { request.current?.abort(); window.removeEventListener(CHANGE_EVENT, reload); window.removeEventListener('focus', reload); };
  }, [reload]);
  const change = async (operation) => {
    const response = await operation();
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return response.data;
  };
  return { presets: [...IMAGE_PRESETS, ...custom], custom, loading, error, reload,
    create: (data) => change(() => mediaService.createCropPreset(data)),
    update: (id, data) => change(() => mediaService.updateCropPreset(id, data)),
    remove: (id) => change(() => mediaService.removeCropPreset(id)),
    restore: (id) => change(() => mediaService.restoreCropPreset(id)),
  };
}
