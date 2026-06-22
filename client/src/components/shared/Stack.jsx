/**
 * Stack / Row — flex layout primitives.
 *
 * Stack  → flex-column  (vertical list of items)
 * Row    → flex-row     (horizontal group of items)
 *
 * Both accept a numeric `gap` (maps to CSS gap) and standard div props.
 * Use spacing tokens via `style={{ gap: 'var(--sp-16)' }}` when you want
 * to reference the design system, or pass a plain number for one-offs.
 *
 * Examples:
 *   <Stack gap={16}>...</Stack>
 *   <Row gap={8} align="flex-start">...</Row>
 *   <Stack gap="var(--sp-20)" style={{ padding: 'var(--sp-24)' }}>...</Stack>
 */
import React from 'react';

export function Stack({
  children,
  gap = 12,
  align,          // alignItems
  justify,        // justifyContent
  wrap = false,
  style,
  ...rest
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Row({
  children,
  gap = 12,
  align = 'center',
  justify,
  wrap = false,
  style,
  ...rest
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
