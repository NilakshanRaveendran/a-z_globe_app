import type { AlertButton } from 'react-native';
import { colors, fontFamily } from '../theme/tokens';

/**
 * `Alert.alert` for the browser, drawn in the app's own language rather than
 * the system dialog: Urbanist, a 20pt-radius white panel on the #000/50 scrim,
 * full-width stacked buttons — the confirming one filled brand red, Cancel
 * (and any other choice) outlined.
 */
export const Alert = {
  alert(title: string, message?: string, buttons: AlertButton[] = [{ text: 'OK' }]): void {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', title);
    dialog.className = 'az-alert-dialog';
    Object.assign(dialog.style, {
      border: 'none', borderRadius: '20px', padding: '24px 20px 20px',
      width: '340px', maxWidth: 'calc(100vw - 48px)', boxSizing: 'border-box',
      fontFamily: `${fontFamily[500]}, system-ui, sans-serif`, color: colors.text, background: colors.surface,
      boxShadow: '0px 10px 30px rgba(0,0,0,0.18)',
    });
    const backdrop = document.createElement('style');
    backdrop.textContent = `.az-alert-dialog::backdrop { background: ${colors.scrim}; }`;
    dialog.appendChild(backdrop);

    const heading = document.createElement('h2');
    heading.textContent = title;
    Object.assign(heading.style, {
      fontFamily: `${fontFamily[700]}, system-ui, sans-serif`, fontWeight: '700',
      fontSize: '18px', lineHeight: '27px', margin: '0 0 6px', textAlign: 'center',
    });
    dialog.appendChild(heading);
    if (message) {
      const body = document.createElement('p');
      body.textContent = message;
      Object.assign(body.style, {
        fontSize: '16px', lineHeight: '24px', margin: '0', color: colors.textSecondary, textAlign: 'center',
      });
      dialog.appendChild(body);
    }

    // The confirming choice leads; Cancel sits last, as on the provider sheets.
    const ordered = [
      ...buttons.filter((b) => b.style !== 'cancel'),
      ...buttons.filter((b) => b.style === 'cancel'),
    ];
    // The first non-cancel choice is the filled red button — "Delete",
    // "Start new cart", "OK"; any others are outlined.
    const primary = ordered.find((b) => b.style !== 'cancel');
    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' });
    for (const action of ordered) {
      const button = document.createElement('button');
      button.textContent = action.text ?? 'OK';
      const filled = action === primary;
      Object.assign(button.style, {
        minHeight: '48px', padding: '12px 16px', fontSize: '15px', cursor: 'pointer',
        fontFamily: `${fontFamily[700]}, system-ui, sans-serif`, fontWeight: '700',
        borderRadius: '14px',
        border: filled ? 'none' : `1px solid ${colors.border}`,
        background: filled ? colors.primary : colors.surface,
        color: filled ? colors.onPrimary : action.style === 'destructive' ? colors.primary : colors.text,
      });
      button.onclick = () => {
        dialog.close();
        action.onPress?.();
      };
      actions.appendChild(button);
    }
    dialog.appendChild(actions);
    dialog.oncancel = () => buttons.find((button) => button.style === 'cancel')?.onPress?.();
    dialog.onclose = () => dialog.remove();
    document.body.appendChild(dialog);
    dialog.showModal();
  },
};
