"use client";

export interface ClientOption {
  id: string;
  name: string;
  companyName?: string | null;
  mainContact?: string | null;
  mainEmail?: string | null;
  billingEmail?: string | null;
  phone?: string | null;
  trn?: string | null;
  address?: string | null;
}

/**
 * Client picker for the document generator. Selecting a client fills the
 * companyName / contact / email / phone / TRN / address inputs in the same
 * form from that client's profile, so an invoice to a saved client doesn't
 * have to be retyped. Fields stay editable afterwards.
 */
export function ClientLinkSelect({ clients }: { clients: ClientOption[] }) {
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const client = clients.find((c) => c.id === e.target.value);
    if (!client) return;
    const form = e.target.closest("form");
    if (!form) return;
    const set = (name: string, value?: string | null) => {
      const el = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
      if (el && value) el.value = value;
    };
    set("companyName", client.companyName ?? client.name);
    set("brandName", client.name);
    set("contactPerson", client.mainContact);
    set("clientEmail", client.billingEmail ?? client.mainEmail);
    set("clientPhone", client.phone);
    set("clientTrn", client.trn);
    set("clientAddress", client.address);
  }

  return (
    <select name="clientId" className="form-input" onChange={onChange} defaultValue="">
      <option value="">No link — enter manually</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.companyName ? ` — ${c.companyName}` : ""}
        </option>
      ))}
    </select>
  );
}
