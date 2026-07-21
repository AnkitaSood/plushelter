import puppeteer from 'puppeteer';

import { WEBMCP_LAUNCH_OPTIONS } from '../core/webmcp-session.js';
import { resolveSiteUrl } from '../utils/site-url.js';

const browser = await puppeteer.launch(WEBMCP_LAUNCH_OPTIONS);

const page = await browser.newPage();
const url = resolveSiteUrl();
await page.goto(url);

console.log(`Open: ${url}`);

const tools = page.webmcp.tools();

for (const tool of tools) {
  console.log(tool.name, tool.description, tool.inputSchema);
}

await browser.close();
