/**
 * Grid — CSS grid layout primitive.
 *
 * `cols` accepts:
 *   - number  → repeat(N, 1fr)   e.g. cols={4}
 *   - string  → passed verbatim  e.g. cols="240px 1fr"
 *
 * Examples:
 *   <Grid cols={4} gap={12}>...</Grid>
 *   <Grid cols="repeat(auto-fill, minmax(220px, 1fr))" gap={16}>...</Grid>
 *   <Grid cols={2} gap="var(--sp-16)">...</Grid>
 */
import React from 'react';

export function Grid({
  children,
  cols = 2,
  gap = 16,
  rowGap,       // override row gap independently
  colGap,       // override col gap independently
  style,
  ...rest
}) {
  const colTemplate = typeof cols === 'number' ? `repeat(${cols}, 1fr)` : cols;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: colTemplate,
        gap: rowGap || colGap ? undefined : gap,
        rowGap: rowGap,
        columnGap: colGap,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
