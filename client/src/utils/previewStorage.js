const baseKey = 'storePreviewTheme';

export const getPreviewStorageKey = (session) => session ? `${baseKey}:${session}` : baseKey;
