/** Opens a generated HTML document (a static form or packet) in a new tab for preview/print — the browser's own Print dialog covers "save as PDF". */
export function openHtmlPreview(html: string): void {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
