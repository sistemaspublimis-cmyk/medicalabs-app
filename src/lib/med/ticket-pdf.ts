function latin(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^\x00-\xff]/g, "?");
}

function pdfText(text: string): string {
  return latin(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, width = 36): string[] {
  const words = latin(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** PDF de una página, solo texto, para compartir el ticket. */
export function ticketPdf(source: string): Uint8Array {
  const lines = source.split(/\r?\n/).flatMap((line) => wrap(line));
  const height = Math.max(420, 36 + lines.length * 14);
  const commands = ["BT", "/F1 11 Tf", "14 TL", `16 ${height - 28} Td`];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("T*");
    commands.push(`(${pdfText(line)}) Tj`);
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 226 ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

function downloadPdf(filename: string, bytes: Uint8Array): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function whatsAppLink(phone: string, note: string): string {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length === 10 ? `52${digits}` : digits;
  const text = encodeURIComponent(note);
  if (full.length < 10) return `https://wa.me/?text=${text}`;
  return `https://wa.me/${full}?text=${text}`;
}

/** whatsapp abre el chat del cliente. archivo solo comparte o descarga el PDF. */
export async function shareTicketPdf(
  filename: string,
  bytes: Uint8Array,
  note: string,
  mode: "whatsapp" | "archivo",
  phone = "",
): Promise<"enviado" | "descargado"> {
  const file = new File([new Uint8Array(bytes)], filename, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Ticket Medicalabs", text: note });
    return "enviado";
  }
  downloadPdf(filename, bytes);
  if (mode === "whatsapp") {
    const message = `${note}\n\nEl PDF ya se descargó. Adjúntalo en este chat.`;
    window.open(whatsAppLink(phone, message), "_blank", "noopener,noreferrer");
  }
  return "descargado";
}
