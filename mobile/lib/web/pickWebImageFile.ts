/**
 * Open the native file/camera picker on web. Inputs appended to document.body
 * are more reliable than hidden <input> nodes inside the React Native Web tree.
 */
export type PickWebImageFileOptions = {
  capture?: 'environment' | 'user';
};

const CANCEL_POLL_INTERVAL_MS = 250;
/** Android Chrome / mobile Safari can populate `input.files` hundreds of ms after focus. */
const CANCEL_POLL_MAX_ATTEMPTS = 40;
/** If focus never returns (picker dismissed on some mobile browsers), stop waiting. */
const PICKER_ABSOLUTE_TIMEOUT_MS = 90_000;

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
    let pollTimer: number | undefined;
    let focusTimer: number | undefined;
    let absoluteTimer: number | undefined;
    let sawWindowBlur = false;
    let pickerDismissPollStarted = false;

    const clearTimers = () => {
      if (pollTimer !== undefined) {
        window.clearTimeout(pollTimer);
        pollTimer = undefined;
      }
      if (focusTimer !== undefined) {
        window.clearTimeout(focusTimer);
        focusTimer = undefined;
      }
      if (absoluteTimer !== undefined) {
        window.clearTimeout(absoluteTimer);
        absoluteTimer = undefined;
      }
    };

    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      clearTimers();
      input.remove();
      resolve(file);
    };

    const resolveFileFromInput = () => finish(input.files?.[0] ?? null);

    input.addEventListener(
      'change',
      () => {
        if (input.files?.length) {
          resolveFileFromInput();
          return;
        }
        // Some WebViews fire `change` before `files` is populated.
        window.setTimeout(resolveFileFromInput, 0);
      },
      { once: true },
    );

    const pollForSelectionAfterDismiss = (attempt = 0) => {
      if (settled) return;
      if (input.files?.length) {
        resolveFileFromInput();
        return;
      }
      if (attempt >= CANCEL_POLL_MAX_ATTEMPTS) {
        finish(null);
        return;
      }
      pollTimer = window.setTimeout(
        () => pollForSelectionAfterDismiss(attempt + 1),
        CANCEL_POLL_INTERVAL_MS,
      );
    };

    const startDismissPolling = () => {
      if (pickerDismissPollStarted || settled) return;
      pickerDismissPollStarted = true;
      focusTimer = window.setTimeout(() => pollForSelectionAfterDismiss(0), 150);
    };

    window.addEventListener(
      'blur',
      () => {
        sawWindowBlur = true;
      },
      { once: true },
    );

    window.addEventListener(
      'focus',
      () => {
        if (sawWindowBlur) startDismissPolling();
      },
      { once: true },
    );

    input.addEventListener(
      'cancel',
      () => {
        finish(null);
      },
      { once: true },
    );

    absoluteTimer = window.setTimeout(() => finish(null), PICKER_ABSOLUTE_TIMEOUT_MS);

    document.body.appendChild(input);
    input.click();
  });
}
