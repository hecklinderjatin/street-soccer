export function leaderboardDialog(
  modal: HTMLElement,
  opener: HTMLElement,
  close: HTMLElement
) {
  const background = () => opener.closest<HTMLElement>('.mobile-lobby-details');
  modal.setAttribute('aria-modal', 'true');

  const hide = () => {
    modal.hidden = true;
    const details = background();
    if (details) details.inert = false;
    opener.focus({ preventScroll: true });
  };
  close.addEventListener('click', hide);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) hide();
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
    } else if (event.key === 'Tab') {
      const buttons = [
        ...modal.querySelectorAll<HTMLButtonElement>(
          'button:not([hidden]):not(:disabled)'
        ),
      ];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus({ preventScroll: true });
      }
    }
  });

  return {
    show() {
      if (!modal.hidden) return;
      modal.hidden = false;
      const details = background();
      if (details) details.inert = true;
      close.focus({ preventScroll: true });
    },
    paginate(
      prev: HTMLElement,
      next: HTMLElement,
      hasPrev: boolean,
      hasNext: boolean
    ) {
      const focused = document.activeElement;
      prev.hidden = !hasPrev;
      next.hidden = !hasNext;
      if (focused === prev && !hasPrev)
        (hasNext ? next : close).focus({ preventScroll: true });
      if (focused === next && !hasNext)
        (hasPrev ? prev : close).focus({ preventScroll: true });
    },
  };
}
