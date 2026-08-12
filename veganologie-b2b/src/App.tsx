import { useEffect, useMemo, useState } from "react";
import type { Order, Product } from "./types";
import { computeProfitability } from "./lib/calc";
import {
  loadCatalog,
  loadCatalogSource,
  saveCatalog,
  loadOrders,
  saveOrder,
  deleteOrder as removeOrder,
  nextQuotationNumber,
  newId,
  emptyCustomer,
  defaultOptions,
  defaultDetails,
} from "./lib/storage";
import { Wordmark } from "./components/Logo";
import { SEED_CATALOG } from "./data/seedCatalog";

// Bump when the built-in catalog changes so returning users get the update.
const SEED_SOURCE = "seed:2";
import { CustomerSection } from "./components/CustomerSection";
import { ProductsSection } from "./components/ProductsSection";
import { OptionsSection } from "./components/OptionsSection";
import { ProfitabilitySection } from "./components/ProfitabilitySection";
import { ImportModal } from "./components/ImportModal";
import { CatalogModal } from "./components/CatalogModal";
import { SavedOrdersModal } from "./components/SavedOrdersModal";
import { QuotationModal } from "./components/QuotationModal";

function blankOrder(): Order {
  const now = new Date().toISOString();
  return {
    id: newId(),
    quotationNumber: "",
    createdAt: now,
    updatedAt: now,
    customer: emptyCustomer(),
    lines: [],
    options: defaultOptions(),
    details: defaultDetails(),
  };
}

type ModalKind = null | "import" | "catalog" | "saved" | "quote";

export default function App() {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order>(blankOrder);
  const [modal, setModal] = useState<ModalKind>(null);
  const [toast, setToast] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // Products are pre-loaded from the Veganologie price + cost files. Seed the
    // built-in catalog on first visit, and also refresh it when we've shipped a
    // newer built-in version — but never overwrite a catalog the user imported
    // or edited themselves (source === "import").
    const stored = loadCatalog();
    const source = loadCatalogSource();
    const outdatedSeed = source.startsWith("seed:") && source !== SEED_SOURCE;
    if (!stored.length || outdatedSeed) {
      setCatalog(SEED_CATALOG);
      saveCatalog(SEED_CATALOG, SEED_SOURCE);
    } else {
      setCatalog(stored);
    }
    setOrders(loadOrders());
  }, []);

  const prof = useMemo(
    () => computeProfitability(order.lines, order.options),
    [order.lines, order.options],
  );

  // any change to the working order marks it dirty (after initial load)
  const update = (patch: Partial<Order>) => {
    setOrder((o) => ({ ...o, ...patch }));
    setDirty(true);
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  };

  const handleImported = (products: Product[]) => {
    setCatalog(products);
    saveCatalog(products, "import");
    flash(`Imported ${products.length} products`);
  };

  const handleCatalogSave = (products: Product[]) => {
    setCatalog(products);
    saveCatalog(products, "import");
    // keep already-added line costs in sync with edited catalog costs
    setOrder((o) => ({
      ...o,
      lines: o.lines.map((l) => {
        const p = products.find((x) => x.id === l.productId);
        return p ? { ...l, cost: p.cost, retail: l.retail } : l;
      }),
    }));
    flash("Catalog updated");
  };

  const doSave = (): Order => {
    let toSave = order;
    if (!toSave.quotationNumber) {
      toSave = { ...toSave, quotationNumber: nextQuotationNumber() };
    }
    toSave = { ...toSave, updatedAt: new Date().toISOString() };
    saveOrder(toSave);
    setOrder(toSave);
    setOrders(loadOrders());
    setDirty(false);
    flash(`Saved ${toSave.quotationNumber}`);
    return toSave;
  };

  const openQuotation = () => {
    // ensure the order has a number before generating
    if (!order.quotationNumber) {
      const withNum = { ...order, quotationNumber: nextQuotationNumber() };
      setOrder(withNum);
    }
    setModal("quote");
  };

  const startNew = () => {
    if (dirty && !confirm("Start a new order? Unsaved changes will be lost.")) return;
    setOrder(blankOrder());
    setDirty(false);
  };

  const openOrder = (o: Order) => {
    setOrder({ ...o });
    setDirty(false);
    setModal(null);
    flash(`Opened ${o.quotationNumber}`);
  };

  const duplicateOrder = (o: Order) => {
    const now = new Date().toISOString();
    setOrder({ ...o, id: newId(), quotationNumber: "", createdAt: now, updatedAt: now });
    setDirty(true);
    setModal(null);
    flash("Duplicated — save to assign a new number");
  };

  const deleteOrder = (id: string) => {
    removeOrder(id);
    setOrders(loadOrders());
    flash("Order deleted");
  };

  return (
    <div className="min-h-full">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-forest-100 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Wordmark />
          <span className="hidden text-xs text-forest-400 sm:inline">
            Corporate Order &amp; Profitability
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button className="btn-ghost" onClick={() => setModal("import")}>
              Import products
            </button>
            <button
              className="btn-ghost"
              onClick={() => setModal("catalog")}
              disabled={!catalog.length}
            >
              Review catalog
            </button>
            <button className="btn-ghost" onClick={() => setModal("saved")}>
              Saved orders
            </button>
            <button className="btn-primary" onClick={startNew}>
              + New order
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {catalog.length === 0 ? (
          <div className="mb-6 rounded-xl border border-dashed border-forest-300 bg-white px-5 py-4 text-sm text-forest-600">
            No products loaded. Click <em>Import products</em> to upload a price and cost file.
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-forest-100 bg-white px-5 py-3 text-sm text-forest-600">
            <strong>{catalog.length} products loaded.</strong> In the Products section below, search
            and click a product to add it, then enter the quantity. Prices update the profitability
            gauge instantly. (Use <em>Import products</em> only if you want to replace the catalog.)
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(360px,420px)]">
          {/* left: build the order */}
          <div className="space-y-6">
            <CustomerSection
              customer={order.customer}
              onChange={(customer) => update({ customer })}
            />
            <ProductsSection
              lines={order.lines}
              catalog={catalog}
              onChange={(lines) => update({ lines })}
            />
            <OptionsSection
              options={order.options}
              onChange={(options) => update({ options })}
            />
          </div>

          {/* right: profitability + actions (sticky) */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <ProfitabilitySection prof={prof} />

            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between text-xs text-forest-400">
                <span>
                  {order.quotationNumber ? order.quotationNumber : "Draft (unsaved)"}
                </span>
                {dirty && <span className="text-amber-600">● unsaved changes</span>}
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={doSave}>
                  Save
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={openQuotation}
                  disabled={order.lines.length === 0}
                >
                  Generate Quotation
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-10 text-center text-xs text-forest-300">
          Veganologie · Internal quotation calculator · All figures in AED, excl. VAT unless
          stated · Data stays in this browser
        </footer>
      </main>

      {/* modals */}
      {modal === "import" && (
        <ImportModal
          hasCatalog={catalog.length > 0}
          onClose={() => setModal(null)}
          onImported={handleImported}
        />
      )}
      {modal === "catalog" && (
        <CatalogModal
          catalog={catalog}
          onClose={() => setModal(null)}
          onSave={handleCatalogSave}
        />
      )}
      {modal === "saved" && (
        <SavedOrdersModal
          orders={orders}
          onClose={() => setModal(null)}
          onOpen={openOrder}
          onDuplicate={duplicateOrder}
          onDelete={deleteOrder}
        />
      )}
      {modal === "quote" && (
        <QuotationModal
          order={order}
          prof={prof}
          onClose={() => setModal(null)}
          onChangeDetails={(details) => update({ details })}
        />
      )}

      {/* toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-forest-800 px-5 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
