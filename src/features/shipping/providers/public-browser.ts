import { existsSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright";

const WINDOWS_BROWSER_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

export async function launchPublicBrowser(options: { defaultHeadless?: boolean; channel?: "msedge"; lifetimeMs?: number } = {}): Promise<Browser> {
  const executablePath = [
    process.env.SCHEDULE_BROWSER_EXECUTABLE_PATH,
    ...(process.platform === "win32" ? WINDOWS_BROWSER_PATHS : []),
  ].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));
  const browser = await chromium.launch({
    headless: true,
    ...(options.channel && process.platform === "win32" ? { channel: options.channel } : executablePath ? { executablePath } : {}),
  });
  const timer = setTimeout(() => { void browser.close().catch(() => undefined); }, options.lifetimeMs ?? 70000);
  browser.on("disconnected", () => clearTimeout(timer));
  return browser;
}

export async function openPublicSession(carrier: "CMA" | "HAPAG", interactive = false): Promise<BrowserContext> {
  const executablePath = [process.env.SCHEDULE_BROWSER_EXECUTABLE_PATH, ...WINDOWS_BROWSER_PATHS]
    .find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));
  const context = await chromium.launchPersistentContext(path.join(process.cwd(), "tmp", "public-sessions", carrier.toLowerCase()), {
    ...(carrier === "CMA" && process.platform === "win32" ? { channel: "msedge" } : executablePath ? { executablePath } : {}), headless: !interactive,
    viewport: { width: 1440, height: 1000 }, locale: "en-US",
    args: interactive ? ["--window-size=1440,1000"] : [],
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown browser error";
    if (/exitCode=21|ProcessSingleton|profile.*in use/i.test(message)) {
      throw new Error(`${carrier}_VERIFICATION_REQUIRED: close the project verification window, then retry`);
    }
    throw new Error(`${carrier}_BROWSER_UNAVAILABLE: ${message.split("\n")[0]}`);
  });
  if (!interactive) {
    const timer = setTimeout(() => { void context.close().catch(() => undefined); }, 70000);
    context.on("close", () => clearTimeout(timer));
  }
  return context;
}
