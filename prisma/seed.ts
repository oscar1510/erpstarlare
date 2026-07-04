import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("Seeding Starflare ERP...");

  // ---- People ----
  const oscar = await db.person.create({
    data: {
      firstName: "Oscar",
      lastName: "Esse",
      email: "oscar.esse@gmail.com",
      role: "Founder / CEO",
      type: "FULL_TIME",
      status: "ACTIVE",
      compensationAmount: 15000,
    },
  });

  const cristina = await db.person.create({
    data: {
      firstName: "Cristina",
      lastName: "Rossi",
      role: "Co-founder / Operations",
      type: "FULL_TIME",
      status: "ACTIVE",
      compensationAmount: 12000,
    },
  });

  const freelancer = await db.person.create({
    data: {
      firstName: "Amina",
      lastName: "Khan",
      role: "Content Editor",
      type: "FREELANCER",
      status: "ACTIVE",
      contractStart: daysFromNow(-120),
      contractEnd: daysFromNow(20),
      compensationAmount: 3500,
    },
  });

  const intern = await db.person.create({
    data: {
      firstName: "Yusuf",
      lastName: "Ali",
      role: "Marketing Intern",
      type: "INTERN",
      status: "ACTIVE",
      contractStart: daysFromNow(-30),
      contractEnd: daysFromNow(60),
      visaPermitDate: daysFromNow(45),
    },
  });

  await db.compensationPayment.create({
    data: { personId: oscar.id, amount: 15000, referencePeriod: "June 2026", status: "PAID", paymentDate: daysFromNow(-5) },
  });
  await db.compensationPayment.create({
    data: { personId: cristina.id, amount: 12000, referencePeriod: "July 2026", status: "DUE", paymentDate: daysFromNow(3) },
  });
  await db.reimbursement.create({
    data: { personId: intern.id, amount: 180, category: "Transport", status: "SUBMITTED", expenseDate: daysFromNow(-2) },
  });

  // ---- Clients ----
  const chicNonna = await db.client.create({
    data: {
      name: "Chic Nonna",
      companyName: "Chic Nonna Restaurant LLC",
      trn: "100234567800003",
      mainContact: "Layla Haddad",
      mainEmail: "layla@chicnonna.ae",
      billingEmail: "accounts@chicnonna.ae",
      phone: "+971 50 123 4567",
      address: "Jumeirah Beach Road, Dubai, UAE",
      status: "ACTIVE",
    },
  });

  const glowCosmetics = await db.client.create({
    data: {
      name: "Glow Cosmetics",
      companyName: "Glow Beauty FZE",
      mainContact: "Sara Ahmed",
      mainEmail: "sara@glowcosmetics.com",
      billingEmail: "billing@glowcosmetics.com",
      status: "ACTIVE",
    },
  });

  const fitTech = await db.client.create({
    data: { name: "FitTech App", companyName: "FitTech Solutions", mainEmail: "hello@fittech.io", status: "LEAD" },
  });

  await db.subscription.create({
    data: {
      clientId: glowCosmetics.id,
      packageName: "Creator Campaign Retainer",
      startDate: daysFromNow(-60),
      renewalDate: daysFromNow(10),
      price: 8000,
      status: "ACTIVE",
    },
  });

  await db.purchase.create({
    data: { clientId: chicNonna.id, type: "SINGLE_CAMPAIGN", date: daysFromNow(-15), amount: 5000, paymentMethod: "Bank transfer" },
  });

  // ---- Invoices ----
  const invoice1 = await db.invoice.create({
    data: {
      number: "SF-2026-0001",
      clientId: chicNonna.id,
      clientNameSnapshot: chicNonna.name,
      clientCompanySnapshot: chicNonna.companyName,
      clientEmailSnapshot: chicNonna.billingEmail,
      clientTRNSnapshot: chicNonna.trn,
      invoiceDate: daysFromNow(-15),
      dueDate: daysFromNow(15),
      description: "Influencer campaign - Ramadan menu launch",
      quantity: 1,
      unitPrice: 5000,
      vat: 250,
      total: 5250,
      paymentMethod: "Bank transfer",
      status: "SENT",
      source: "MANUAL",
    },
  });
  await db.counter.upsert({ where: { id: "invoice-2026" }, update: { value: 1 }, create: { id: "invoice-2026", value: 1 } });

  const invoice2 = await db.invoice.create({
    data: {
      number: "SF-2026-0002",
      clientId: glowCosmetics.id,
      clientNameSnapshot: glowCosmetics.name,
      clientCompanySnapshot: glowCosmetics.companyName,
      clientEmailSnapshot: glowCosmetics.billingEmail,
      invoiceDate: daysFromNow(-40),
      dueDate: daysFromNow(-10),
      description: "Monthly creator retainer - June",
      quantity: 1,
      unitPrice: 8000,
      vat: 400,
      total: 8400,
      paymentMethod: "Stripe",
      status: "PAID",
      source: "STRIPE",
    },
  });
  await db.counter.update({ where: { id: "invoice-2026" }, data: { value: 2 } });

  const ledgerFromInvoice2 = await db.ledgerEntry.create({
    data: {
      date: daysFromNow(-38),
      type: "INCOME",
      category: "Stripe Revenue",
      amount: 8400,
      clientId: glowCosmetics.id,
      paymentMethod: "Stripe",
      invoiceId: invoice2.id,
      sourceModule: "Invoice",
      sourceId: invoice2.id,
      notes: "Invoice SF-2026-0002",
    },
  });
  await db.invoice.update({ where: { id: invoice2.id }, data: { ledgerEntryId: ledgerFromInvoice2.id } });

  await db.payment.create({
    data: {
      type: "INCOMING",
      amount: 8400,
      date: daysFromNow(-38),
      method: "Stripe",
      payer: glowCosmetics.name,
      payee: "Starflare",
      invoiceId: invoice2.id,
      clientId: glowCosmetics.id,
      reconciliation: "MATCHED",
    },
  });

  // Overdue invoice for the dashboard
  await db.invoice.create({
    data: {
      number: "SF-2026-0003",
      clientId: fitTech.id,
      clientNameSnapshot: fitTech.name,
      invoiceDate: daysFromNow(-45),
      dueDate: daysFromNow(-20),
      description: "Setup fee",
      quantity: 1,
      unitPrice: 2000,
      vat: 100,
      total: 2100,
      status: "OVERDUE",
      source: "MANUAL",
    },
  });
  await db.counter.update({ where: { id: "invoice-2026" }, data: { value: 3 } });

  // ---- Received invoices / supplier expenses ----
  const supplierInvoice = await db.receivedInvoice.create({
    data: {
      vendorName: "Adobe Systems",
      vendorCategory: "Software provider",
      invoiceNumber: "ADB-88213",
      invoiceDate: daysFromNow(-10),
      dueDate: daysFromNow(5),
      amount: 450,
      vat: 22.5,
      expenseCategory: "Software",
      paymentStatus: "PENDING_PAYMENT",
      recurring: true,
    },
  });

  // ---- Bank ----
  const statement = await db.bankStatement.create({
    data: {
      bankName: "Emirates NBD",
      accountName: "Starflare Marketing LLC",
      iban: "AE070331234567890123456",
      periodStart: daysFromNow(-30),
      periodEnd: daysFromNow(0),
      openingBalance: 120000,
      closingBalance: 128400,
    },
  });
  await db.bankTransaction.create({
    data: { bankStatementId: statement.id, date: daysFromNow(-38), description: "GLOW COSMETICS FZE TRANSFER", moneyIn: 8400, category: "Client payment", reconciliation: "MATCHED", linkedInvoiceId: invoice2.id },
  });
  await db.bankTransaction.create({
    data: { bankStatementId: statement.id, date: daysFromNow(-7), description: "ADOBE SYSTEMS SOFTWARE", moneyOut: 450, category: "Software", reconciliation: "UNMATCHED" },
  });
  await db.bankTransaction.create({
    data: { bankStatementId: statement.id, date: daysFromNow(-2), description: "UNKNOWN TRANSFER REF 88231", moneyIn: 1200, reconciliation: "UNMATCHED" },
  });

  // ---- Expenses (Quick Expense Scanner) ----
  await db.expense.create({
    data: {
      actorType: "OSCAR",
      actorLabel: "Oscar",
      personId: oscar.id,
      vendor: "ADNOC",
      expenseDate: daysFromNow(-3),
      amount: 120,
      currency: "AED",
      paymentMethod: "Company card",
      category: "Transport",
      status: "RECORDED",
      description: "Fuel",
    },
  });
  await db.expense.create({
    data: {
      actorType: "CRISTINA",
      actorLabel: "Cristina",
      personId: cristina.id,
      vendor: "Costa Coffee",
      expenseDate: daysFromNow(-1),
      amount: 45,
      currency: "AED",
      paymentMethod: "Personal card",
      category: "Food & Beverage",
      status: "REIMBURSABLE",
      reimbursable: true,
      reimbursePersonId: cristina.id,
      reimburseAmount: 45,
      description: "Client meeting coffee",
    },
  });
  await db.expense.create({
    data: {
      actorType: "FREELANCER",
      actorLabel: "Amina Khan",
      personId: freelancer.id,
      vendor: "Careem",
      expenseDate: daysFromNow(-6),
      amount: 60,
      currency: "AED",
      paymentMethod: "Cash",
      category: "Transport",
      status: "NEEDS_REVIEW",
    },
  });

  // ---- General ledger (expenses) ----
  await db.ledgerEntry.create({
    data: { date: daysFromNow(-3), type: "EXPENSE", category: "Transport", amount: 120, vendorName: "ADNOC", sourceModule: "Expense" },
  });
  await db.ledgerEntry.create({
    data: { date: daysFromNow(-10), type: "EXPENSE", category: "Software", amount: 450, vat: 22.5, vendorName: "Adobe Systems", sourceModule: "ReceivedInvoice", sourceId: supplierInvoice.id },
  });
  await db.ledgerEntry.create({
    data: { date: daysFromNow(-5), type: "EXPENSE", category: "HR Compensation", amount: 15000, personId: oscar.id, sourceModule: "CompensationPayment" },
  });

  // ---- Admin & Tax ----
  await db.taxRecord.create({
    data: {
      docType: "CORPORATE_TAX_SUBMISSION",
      taxRefNumber: "CT-99881122",
      authority: "Federal Tax Authority",
      fiscalPeriod: "FY2025",
      submissionDate: daysFromNow(-60),
      nextDueDate: daysFromNow(25),
      status: "SUBMITTED",
    },
  });
  await db.taxRecord.create({
    data: { docType: "VAT_REGISTRATION", taxRefNumber: "100234567800003", authority: "Federal Tax Authority", nextDueDate: daysFromNow(50), status: "APPROVED" },
  });

  // ---- Rent ----
  const rent = await db.rentRecord.create({
    data: {
      landlordName: "Dubai Media City Authority",
      officeName: "Starflare HQ",
      location: "Dubai Media City, Building 4",
      startDate: daysFromNow(-300),
      endDate: daysFromNow(65),
      monthlyRent: 9000,
      deposit: 18000,
      paymentSchedule: "4 cheques/year",
      noticePeriod: "60 days",
      renewalDate: daysFromNow(65),
    },
  });

  // ---- Contracts ----
  await db.receivedContract.create({
    data: {
      counterpartyName: "Dubai Media City Authority",
      contractType: "Lease agreement",
      startDate: daysFromNow(-300),
      endDate: daysFromNow(65),
      contractValue: 36000,
      status: "ACTIVE",
    },
  });
  await db.sentContract.create({
    data: {
      clientId: chicNonna.id,
      partnerName: chicNonna.name,
      contractType: "Campaign agreement",
      packageName: "Ramadan Launch Campaign",
      price: 5000,
      duration: "1 month",
      startDate: daysFromNow(-15),
      endDate: daysFromNow(15),
      status: "ACTIVE",
    },
  });
  const policy = await db.platformPolicy.create({
    data: { policyName: "Creator Terms", versionNumber: "1.3", effectiveDate: daysFromNow(-90), reviewDate: daysFromNow(90), status: "ACTIVE" },
  });
  await db.policyVersion.create({ data: { policyId: policy.id, versionNumber: "1.3", changeNotes: "Updated usage rights clause" } });

  // ---- Deadlines (mirroring the auto logic for a populated calendar) ----
  await db.deadline.createMany({
    data: [
      { title: "Invoice SF-2026-0001 due", category: "Invoice Due", date: daysFromNow(15), status: "UPCOMING", autoGenerated: true, sourceModule: "Invoice", sourceId: invoice1.id, relatedClientId: chicNonna.id },
      { title: "Pay Adobe Systems invoice", category: "Supplier Invoice Due", date: daysFromNow(5), status: "DUE_SOON", autoGenerated: true, sourceModule: "ReceivedInvoice", sourceId: supplierInvoice.id, relatedVendor: "Adobe Systems" },
      { title: "Lease ends – Starflare HQ", category: "Lease End", date: daysFromNow(65), status: "UPCOMING", autoGenerated: true, sourceModule: "RentRecord", sourceId: rent.id },
      { title: "Contract end – Amina Khan", category: "HR Contract", date: daysFromNow(20), status: "DUE_SOON", autoGenerated: true, sourceModule: "Person", sourceId: freelancer.id, relatedPersonId: freelancer.id },
      { title: "Visa / permit expiry – Yusuf Ali", category: "Visa / Permit", date: daysFromNow(45), status: "UPCOMING", autoGenerated: true, sourceModule: "Person", sourceId: intern.id, relatedPersonId: intern.id },
      { title: "Corporate tax submission due", category: "Tax / License", date: daysFromNow(25), status: "UPCOMING", autoGenerated: true, sourceModule: "TaxRecord", sourceId: (await db.taxRecord.findFirst({ where: { docType: "CORPORATE_TAX_SUBMISSION" } }))!.id },
      { title: "Compensation due – Cristina Rossi", category: "HR Compensation Due", date: daysFromNow(3), status: "DUE_SOON", autoGenerated: true, sourceModule: "CompensationPayment", relatedPersonId: cristina.id },
    ],
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
