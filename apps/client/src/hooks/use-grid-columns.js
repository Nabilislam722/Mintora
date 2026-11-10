import { useEffect, useState } from "react";

// Card columns on the home page at the current width: 2 on phones, 3 from md, 4 from lg, 5 from xl
// (Tailwind's breakpoints). Collections and Top NFTs both use it, so their cards line up.
const BREAKPOINTS = [
  ["(min-width: 1280px)", 5],
  ["(min-width: 1024px)", 4],
  ["(min-width: 768px)", 3],
];

const columnsNow = () => BREAKPOINTS.find(([query]) => window.matchMedia(query).matches)?.[1] ?? 2;

export function useGridColumns() {
  const [columns, setColumns] = useState(columnsNow);

  useEffect(() => {
    const lists = BREAKPOINTS.map(([query]) => window.matchMedia(query));
    const update = () => setColumns(columnsNow());
    lists.forEach((list) => list.addEventListener("change", update));
    return () => lists.forEach((list) => list.removeEventListener("change", update));
  }, []);

  return columns;
}

// Width of one card in a row of `columns` cards with gap-4 (1rem) between them
export const columnWidth = (columns) => `calc((100% - ${columns - 1}rem) / ${columns})`;
