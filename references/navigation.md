# Navigation and App Shell

Use `navigation` or `nav` to improve orientation, movement, and access without
changing routes, permissions, deep links, or analytics contracts. Navigation
should be calmer than the work it frames.

## Build from information architecture

1. Inventory destinations, object scopes, user roles, and route relationships.
2. Distinguish global navigation, workspace or account switching, local
   navigation, breadcrumbs, and in-page controls.
3. Give each destination one stable name and one primary home.
4. Show current location and scope without relying on color alone.
5. Keep frequent actions reachable while avoiding duplicate competing entry
   points.

Use groups only when users can predict their contents. Preserve stable order;
do not reorder navigation from usage telemetry without user control. Badges
communicate actionable state, not decoration.

## Responsive behavior

- Keep the current location visible when the shell collapses.
- Preserve keyboard order and return focus to the trigger when an overlay
  navigation closes.
- Do not put essential destinations behind hover-only disclosure.
- Make mobile navigation dismissible, scrollable, and safe with browser back.
- Keep account, workspace, and product navigation visually distinct when they
  change different scopes.

## Search and command access

Search returns content; a command interface runs or navigates to actions. Label
them accordingly. Results expose type and destination, support arrow and
keyboard selection, preserve query on recoverable failure, and do not reveal
objects outside the user's permissions.

## Four axes and verification

Navigation generally keeps Expression and Motion below the main content while
matching its Density and Warmth. Verify direct URLs, back and forward history,
refresh, deep links, selected state, overflow, long labels, zoom, keyboard,
touch, permissions, loading, empty search, and failed navigation.
