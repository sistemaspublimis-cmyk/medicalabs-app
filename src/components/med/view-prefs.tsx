import { ViewSwitch } from "@/components/med/product-board";
import { useMed, type NameStyle, type StockScope, type UiScale } from "@/lib/med/store";

function Choice<T extends string | number>({
  value,
  current,
  label,
  onPick,
}: {
  value: T;
  current: T;
  label: string;
  onPick: (value: T) => void;
}) {
  const on = value === current;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onPick(value)}
      className={"h-11 rounded-xl text-sm font-semibold " + (on ? "bg-blue text-card" : "border border-line bg-card")}
    >
      {label}
    </button>
  );
}

export function ViewPrefs({ withStep = false }: { withStep?: boolean }) {
  const nameStyle = useMed((state) => state.nameStyle);
  const stockScope = useMed((state) => state.stockScope);
  const productView = useMed((state) => state.productView);
  const qtyStep = useMed((state) => state.qtyStep);
  const setNameStyle = useMed((state) => state.setNameStyle);
  const setStockScope = useMed((state) => state.setStockScope);
  const setProductView = useMed((state) => state.setProductView);
  const setQtyStep = useMed((state) => state.setQtyStep);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">Nombres y detalles</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Choice<NameStyle> value="completo" current={nameStyle} label="Completos" onPick={setNameStyle} />
          <Choice<NameStyle> value="corto" current={nameStyle} label="Abreviados" onPick={setNameStyle} />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Qué productos ver</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Choice<StockScope> value="todos" current={stockScope} label="Todos" onPick={setStockScope} />
          <Choice<StockScope> value="disponibles" current={stockScope} label="Solo disponibles" onPick={setStockScope} />
        </div>
      </div>
      <ViewSwitch value={productView} onChange={setProductView} />
      {withStep ? (
        <div>
          <p className="text-sm font-semibold">Al sumar</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([1, 6, 12] as const).map((step) => (
              <Choice key={step} value={step} current={qtyStep} label={`De ${step}`} onPick={setQtyStep} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ScalePrefs() {
  const uiScale = useMed((state) => state.uiScale);
  const setUiScale = useMed((state) => state.setUiScale);
  const options: { id: UiScale; label: string }[] = [
    { id: "compacta", label: "Compacta" },
    { id: "normal", label: "Normal" },
    { id: "grande", label: "Grande" },
  ];
  return (
    <div>
      <p className="text-sm font-semibold">Tamaño en este dispositivo</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map((option) => (
          <Choice key={option.id} value={option.id} current={uiScale} label={option.label} onPick={setUiScale} />
        ))}
      </div>
    </div>
  );
}
