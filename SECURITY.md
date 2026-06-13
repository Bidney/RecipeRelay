# Security Policy

## Supported versions

The latest published version is supported.

## Reporting a vulnerability

Please report security issues through the GitHub repository:

https://github.com/bidney/RecipeRelay/issues

If the issue includes sensitive details, avoid posting exploit steps publicly. Open a minimal issue asking for a private contact path.

## Security goals

Recipe Relay should remain:

- Backend-free
- Analytics-free
- Free of remote JavaScript
- Minimal in permissions
- Clear about what data it handles

## Current data flow

Recipe text is read from the active tab only after the user clicks the extension. The generated shopping list remains local and is encoded directly into the QR code shown in the popup.
