const ROUTE_BY_MODULE: Record<string, (id: string) => string> = {
  Invoice: (id) => `/billing/${id}`,
  ReceivedInvoice: (id) => `/received-invoices/${id}`,
  Person: (id) => `/hr/${id}`,
  CompensationPayment: () => `/hr`,
  Reimbursement: () => `/hr`,
  Subscription: () => `/clients`,
  TaxRecord: (id) => `/admin-tax/${id}`,
  RentRecord: (id) => `/rent/${id.replace(/-renewal$/, "")}`,
  ReceivedContract: (id) => `/contracts/received/${id}`,
  SentContract: (id) => `/contracts/sent/${id}`,
  PlatformPolicy: (id) => `/contracts/policies/${id}`,
};

export function deadlineSourceUrl(sourceModule?: string | null, sourceId?: string | null): string | null {
  if (!sourceModule || !sourceId) return null;
  const builder = ROUTE_BY_MODULE[sourceModule];
  return builder ? builder(sourceId) : null;
}
