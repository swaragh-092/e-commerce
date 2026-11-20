export default (src, globalName) => new Promise((resolve, reject) => {
    if (globalName && window[globalName]) {
        resolve(window[globalName]);
        return;
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
        if (globalName && window[globalName]) {
            resolve(window[globalName]);
            return;
        }
        if (existing.dataset.loaded === 'true') {
            resolve(globalName ? window[globalName] : true);
            return;
        }
        existing.addEventListener('load', () => resolve(globalName ? window[globalName] : true), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
        script.dataset.loaded = 'true';
        resolve(globalName ? window[globalName] : true);
    };
    script.onerror = (error) => {
        script.remove();
        reject(error);
    };
    document.body.appendChild(script);
});
