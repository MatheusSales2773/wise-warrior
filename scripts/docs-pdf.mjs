// Gera os PDFs de docs/ a partir das fontes em Markdown, com o Chromium do Playwright.
// Uso: node scripts/docs-pdf.mjs   (precisa de internet para carregar marked e mermaid do CDN)
// Uma fonte pode trazer o próprio <style>, inclusive @page com fundo e rodapé; os caminhos
// img/... são relativos à pasta da fonte e entram no PDF embutidos.
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const jobs = [
  // A3 deitado para o diagrama ER, que tem 26 tabelas, caber legível numa página.
  ['dados/DADOS.md', 'DADOS.pdf', 'A3 landscape'],
  ['academico/visao.md', 'Documento de Visão - Grupo 2.pdf', 'A4'],
  ['academico/arquitetura.md', 'Documento de Arquitetura de Software.pdf', 'A4'],
  ['academico/interface.md', 'Documentação de Interface e Prototipação.pdf', 'A4'],
];

const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const inlineImages = (text, folder) => text.replace(/img\/[\w.-]+\.(png|jpe?g)/g, (path, ext) =>
  `data:${mime[ext]};base64,${readFileSync(docs + folder + '/' + path).toString('base64')}`);

const css = `
  body { font: 11pt/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1d1b2e; margin: 0; }
  h1 { color: #2b2370; border-bottom: 3px solid #e0b23a; padding-bottom: 6px; }
  h2 { color: #2b2370; margin-top: 1.6em; break-after: avoid; }
  h3, h4 { break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 9.5pt; break-inside: auto; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #c9c5dd; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eeeaf9; }
  code { font-size: 9pt; background: #f3f1fa; padding: 0 3px; border-radius: 3px; }
  h3:has(+ .mermaid), h3:has(+ p + .mermaid) { break-before: page; }
  .mermaid { break-inside: avoid; text-align: center; }
  .mermaid svg { width: auto !important; min-width: 60%; max-width: 100% !important; max-height: 235mm; height: auto; }
`;

const browser = await chromium.launch();
try {
  for (const [source, target, size] of jobs) {
    const markdown = inlineImages(readFileSync(docs + source, 'utf8'), dirname(source));
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>@page { size: ${size}; margin: 18mm 15mm; }${css}</style><main></main>
      <script src="https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>`, { waitUntil: 'networkidle' });
    await page.evaluate(async (md) => {
      document.querySelector('main').innerHTML = window.marked.parse(md);
      for (const code of document.querySelectorAll('code.language-mermaid')) {
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = code.textContent;
        code.parentElement.replaceWith(div);
      }
      window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', er: { useMaxWidth: true } });
      await window.mermaid.run();
    }, markdown);
    await page.pdf({
      path: docs + target,
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page.close();
    console.log(`docs/${target}`);
  }
} finally {
  await browser.close();
}
