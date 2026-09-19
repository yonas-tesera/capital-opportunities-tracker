import type { Currency } from "@/domain/enums";
import { formatCurrency } from "@/lib/format";

export function CurrencyAmount({ amount, currency, className = "" }: { amount: string; currency: Currency; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatCurrency(amount, currency)}</span>;
}
