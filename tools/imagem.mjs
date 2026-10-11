// Renderiza o HTML do relatório em PNG. Usa o Chrome que já existe na máquina (e nos
// servidores do GitHub), então não precisa baixar navegador nenhum.
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CAMINHOS = [
  process.env.CHROME,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/google/chrome/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

export function acharChrome() {
  return CAMINHOS.find((caminho) => existsSync(caminho)) ?? null;
}

export async function renderizar(html, { largura = 780, escala = 1.5 } = {}) {
  const chrome = acharChrome();
  if (!chrome) throw new Error('não achei o Chrome (defina CHROME=<caminho do executável>)');
  const navegador = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
  });
  try {
    const pagina = await navegador.newPage();
    await pagina.setViewport({ width: largura, height: 1200, deviceScaleFactor: escala });
    await pagina.setContent(html, { waitUntil: 'load' });
    return await pagina.screenshot({ fullPage: true, type: 'png' });
  } finally {
    await navegador.close();
  }
}
