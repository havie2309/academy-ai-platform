# Accessibility Checklist

Manual checklist for `K-11` smoke verification on the current web UI.

## Login

- Username and password inputs have visible labels.
- Error state is announced with `role="alert"`.
- Submit button is reachable by keyboard and has visible focus.
- Browser autofill works with `autocomplete="username"` and `autocomplete="current-password"`.

## Chat

- Composer textarea is reachable by keyboard.
- `Enter` sends and `Shift+Enter` keeps a newline.
- Suggested prompt cards are keyboard-activatable with `Enter` or `Space`.
- Streaming/loading state is visible without relying only on color.
- Citation blocks remain readable when content wraps on small screens.

## Documents / Admin

- Buttons and links keep a visible focus outline.
- Tables or stat blocks remain readable at 320px width.
- Error and empty states use text, not color only.
- Admin-only actions are hidden or disabled for non-admin roles.

## Contrast / Motion

- Primary text and interactive controls pass a quick contrast spot-check.
- Pulsing or bouncing indicators do not block task completion.
- Reduced-motion follow-up: verify core flows still work if animations are disabled at OS level.
