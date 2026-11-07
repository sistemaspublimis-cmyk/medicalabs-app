import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function CompareBars({
  rows,
  aLabel,
  bLabel,
  format,
}: {
  rows: { name: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  format: (value: number) => string;
}) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-muted">No hay datos en estas fechas.</p>;
  return (
    <div className="mt-3 h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => format(Number(value))} />
          <Legend />
          <Bar dataKey="a" name={aLabel} fill="#0d3b66" radius={[0, 4, 4, 0]} />
          <Bar dataKey="b" name={bLabel} fill="#3dcb74" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
