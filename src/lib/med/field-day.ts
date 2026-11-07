import type { NameStyle } from "@/lib/med/store";

export function displayName(name: string, style: NameStyle): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (style !== "corto") return clean;
  const words = clean.split(" ").slice(0, 3).join(" ");
  if (words.length < clean.length) {
    const cut = words.length > 32 ? words.slice(0, 30).trim() : words;
    return `${cut}…`;
  }
  return clean.length > 32 ? `${clean.slice(0, 30).trim()}…` : clean;
}

export function productOnHand(price: number, qty: number): boolean {
  return price > 0 && qty > 0;
}

export const OFF_SHELF = "border-zinc-300 bg-zinc-200 text-zinc-500 grayscale";
