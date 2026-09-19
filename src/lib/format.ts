import type { Currency } from "@/domain/enums";

// Fixed locale and UTC so server and client render the same text.
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export const formatDate = (iso: string): string => dateFormatter.format(new Date(iso));

const currencyFormatters = new Map<Currency, Intl.NumberFormat>();

/** `amount` is a decimal string; Intl formats it exactly, without going through a float. */
export function formatCurrency(amount: string, currency: Currency): string {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(amount as `${number}`);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const fullDateTimeFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "long", timeZone: "UTC" });

/** Compact timestamp for display, always UTC and labelled as such. */
export const formatDateTime = (iso: string): string => `${dateTimeFormatter.format(new Date(iso))} UTC`;

/** Long form for tooltips. */
export const formatFullDateTime = (iso: string): string => fullDateTimeFormatter.format(new Date(iso));
