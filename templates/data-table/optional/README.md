# Optional 10,000-row virtualization lab

This fixture is intentionally not installed by `wingman-design add data-table`.
The default table is non-virtualized. First profile a real production data set
and confirm that server pagination or query limits cannot solve the measured
rendering problem.

If virtualization is justified:

1. Copy `VirtualizedBody.fixture.tsx` into a temporary performance branch.
2. Add pinned `@tanstack/react-virtual@3.14.10`.
3. Connect it behind the project-owned table adapter. Keep sorting, filtering,
   pagination, selection, and column behavior in TanStack Table.
4. Test row measurement with long and localized content, sticky headers,
   keyboard focus restoration, screen-reader row position, zoom, touch, and
   reduced motion.
5. Record before/after render and interaction timings. Remove the adapter when
   the measured improvement does not justify the semantic and maintenance cost.

Never enable this fixture only because a test contains 10,000 sample rows.
