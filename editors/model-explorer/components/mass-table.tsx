import { formatQuantity } from "../../shared/format.js";
import { Cell, EmptyState, Row, Table } from "../../shared/ui.js";
import type { MassRow } from "../logic.js";

/** A signed quantity, coloured by direction, blank when nothing moved. */
function Delta({
  value,
  decimals = 0,
}: {
  value: number | null;
  decimals?: number;
}) {
  if (value == null) {
    return <span className="text-slate-300 dark:text-slate-600">—</span>;
  }

  const tone =
    value > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  const shown = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`font-semibold ${tone}`}>
      {value > 0 ? "+" : "−"}
      {shown}
    </span>
  );
}

/**
 * The masses of the selected revision, per Speckle type, with how far each moved
 * since the previous revision.
 *
 * These are the numbers read straight off the model's own properties — nobody
 * retyped them, so the quantities and the geometry cannot drift apart.
 */
export function MassTable({
  rows,
  vanished,
  showDeltas,
}: {
  rows: MassRow[];
  vanished: string[];
  showDeltas: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No quantities in this revision"
        hint="The objects carry no volume, area or length properties, or the revision has not been walked yet."
      />
    );
  }

  // Every figure column is right-aligned, so its header has to be too.
  const number = (label: string) => ({ label, align: "right" as const });

  const headers = showDeltas
    ? [
        "Category",
        number("Count"),
        number("Δ"),
        number("Volume"),
        number("Δ"),
        number("Area"),
        number("Δ"),
        number("Length"),
        "Unit",
      ]
    : [
        "Category",
        number("Count"),
        number("Volume"),
        number("Area"),
        number("Length"),
        "Unit",
      ];

  return (
    <div className="flex flex-col gap-2">
      <Table headers={headers}>
        {rows.map((row) => (
          <Row key={row.speckleType}>
            <Cell
              title={row.speckleType}
              className="font-medium text-slate-900 dark:text-slate-100"
            >
              {row.shortType}
            </Cell>
            <Cell align="right" mono>
              {row.objectCount.toLocaleString()}
            </Cell>
            {showDeltas && (
              <Cell align="right" mono>
                <Delta value={row.countDelta} />
              </Cell>
            )}
            <Cell align="right" mono>
              {formatQuantity(row.volume)}
            </Cell>
            {showDeltas && (
              <Cell align="right" mono>
                <Delta value={row.volumeDelta} decimals={2} />
              </Cell>
            )}
            <Cell align="right" mono>
              {formatQuantity(row.area)}
            </Cell>
            {showDeltas && (
              <Cell align="right" mono>
                <Delta value={row.areaDelta} decimals={2} />
              </Cell>
            )}
            <Cell align="right" mono>
              {formatQuantity(row.length)}
            </Cell>
            <Cell className="text-slate-400 dark:text-slate-500">
              {row.unit ?? "—"}
            </Cell>
          </Row>
        ))}
      </Table>

      {vanished.length > 0 && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Gone in this revision:{" "}
          <span className="font-medium text-red-600 dark:text-red-400">
            {vanished.join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}
