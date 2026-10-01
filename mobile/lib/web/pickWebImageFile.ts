/**
 * Open the native file/camera picker on web. Inputs appended to document.body
 * are more reliable than hidden <input> nodes inside the React Native Web tree.
 */
export type PickWebImageFileOptions = {
  capture?: 'environment' | 'user';
};

export function pickWebImageFile(options: PickWebImageFileOptions = {}): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (options.capture) {
      input.setAttribute('capture', options.capture);
    }
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener(
      'change',
      () => {
        finish(input.files?.[0] ?? null);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();

    window.addEventListener(
      'focus',
      () => {
        window.setTimeout(() => {
          if (!input.files?.length) {
            finish(null);
          }
        }, 400);
      },
      { once: true },
    );
  });
}
