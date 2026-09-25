// Payload builders for the "Contract submitted" page (added 25-Sep-2026).
//
// Shows, side by side, exactly what the portal sends to the Geidea DD Backend and what the Backend
// then sends to DDS — built from the request the merchant just submitted, using the field names and
// mapping in Backend Stories S2 (§3a request, §4c Create DDA mapping, §8 response).

import { DDCreateContractRequest, DirectDebitContract } from "./types";
import { addDays, formatDateNice, parseDateStr } from "./direct-debit";

/** YYYY-MM-DD → dd/MM/yyyy (the DDS client's date format, S1 §6.3). */
function ddsDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** The POST /direct-debit/v1/contracts body, with empty optional fields removed. */
export function beRequestBody(req: DDCreateContractRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { ...req };
  for (const k of Object.keys(body)) {
    if (body[k] === undefined || body[k] === "") delete body[k];
  }
  return body;
}

/** DDS Create DDA body — S2 §4c. null when TBFC (DDS isn't called at creation, S2 §4.1). */
export function ddsCreateDdaBody(req: DDCreateContractRequest): Record<string, unknown> | null {
  if (req.bankInfoFillByCustomer) return null;
  const body: Record<string, unknown> = {
    customerFullName: req.customerName,
    customerEmail: req.customerEmail,
    customerMobileNumber: req.customerMobile,
    ddaReferenceNumber: req.merchantReference,
    customerType: "Individual",
    customerIdType: "UAE Emirates Identity Card",
    customerIdNumber: req.emiratesId.replace(/\D/g, ""),
    custNid: req.emiratesId.replace(/\D/g, ""),
    commencesOn: ddsDate(req.startDate),
    expiresOn: ddsDate(req.endDate),
    minAmount: req.minAmount,
    maxAmount: req.maxAmount,
    paymentFrequency: req.frequencyCeiling,
    amountType: req.amountType,
    userPreferPaymentMethod: req.paymentMethodType,
    customerAccountBankName: req.bankName,
  };
  if (req.paymentMethodType === "Bank Account") {
    body.customerBankAccountTitle = req.accountHolderTitle;
    body.customerBankAccountType = req.bankAccountType;
    body.customerBankAccountNumber = req.iban?.replace(/\s/g, "");
  } else {
    body.customerCreditCardNumber = req.cardNumber?.replace(/\s/g, "");
    body.creditCardHolderName = req.cardHolderName;
  }
  return body;
}

/** What the Backend returns to the portal — S2 §8 (201). Prototype values for ids. */
export function beResponseBody(
  c: DirectDebitContract,
  req: DDCreateContractRequest,
  suppressed: boolean,
  reviewUrl: string,
  expiresAt: string
): Record<string, unknown> {
  const tbfc = req.bankInfoFillByCustomer;
  const body: Record<string, unknown> = {
    code: "000",
    success: true,
    message: "Contract created",
    timestamp: new Date().toISOString(),
    data: {
      mandateId: c.id,
      merchantReference: req.merchantReference,
      ddaId: tbfc ? null : "164132",
      status: tbfc ? null : "PNDG",
      statusLabel: tbfc ? "Awaiting Customer Details" : "Pending",
      reviewUrl,
      reviewLinkExpiresAt: expiresAt,
      ...(suppressed && !tbfc
        ? {
            signingUrl:
              "https://directdebit.ae/api/appApi/v1/customer/uaepass-signer-process?mode=web&ddarId=4333&redirectUrl=https%3A%2F%2F<portal-host>%2Fdirect-debit%2Fv1%2Fwebhooks%2Fdirect-debit%2Fsigning-callback",
          }
        : {}),
      subscription: {
        subscriptionId: `sub_${c.id}`,
        status: "Pending Activation",
        frequency: req.frequency,
        startDate: req.firstCollectionDate,
        endDate: req.endDate,
      },
      schedule: req.collections.map((col, i) => ({
        sequenceNumber: i + 1,
        dueDate: col.dueDate,
        amount: col.amount,
        status: "Scheduled",
      })),
    },
  };
  return body;
}

/** DDS Create DDA 201 response — S2 §5. */
export function ddsResponseBody(req: DDCreateContractRequest): Record<string, unknown> | null {
  if (req.bankInfoFillByCustomer) return null;
  return { ddaId: 164132, ddarId: 4333 };
}

/** Review link expiry = created + contract_review_expiry_days (S2 §6.2). */
export function reviewLinkExpiry(createdAt: Date, days: number): string {
  return formatDateNice(addDays(createdAt, days));
}

export function isoToNice(iso: string): string {
  return formatDateNice(parseDateStr(iso));
}
