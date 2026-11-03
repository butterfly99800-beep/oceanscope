import { load } from "cheerio";
import { request, type APIRequestContext } from "playwright";

export const OOCL_MOBILE_URL = "https://pbservice.moc.oocl.com/party/sailingschedule/MOBILE/mobile_ss_search.jsf?ANONYMOUS_BEHAVIOR=BUILD_UP&ENTRY=MCC&ENTRY_TYPE=OOCL";
export const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export function readForm(html: string, pageUrl: string) {
  const $ = load(html);
  const form = $("form#form");
  if (!form.length && /\[QF17\]/i.test($("body").text())) throw new Error("OOCL_AUTH_REQUIRED: QF17");
  if (!form.length) throw new Error("OOCL_HTTP_RESPONSE_INVALID: public JSF form missing");
  const url = new URL(form.attr("action") || pageUrl, pageUrl);
  if (url.origin !== new URL(OOCL_MOBILE_URL).origin) throw new Error("OOCL_HTTP_RESPONSE_INVALID: unexpected form origin");
  // Reproduce the official decorateAnonymousForm hook, without executing scripts.
  const suffix = html.match(/document\.forms\["form"\]\.action\s*=\s*act\s*\+\s*"(\?[^"\r\n]+)"/)?.[1];
  if (suffix) url.search = suffix;
  else for (const [key, value] of new URL(pageUrl).searchParams) url.searchParams.set(key, value);
  const fields: Record<string, string> = {};
  form.find("input[name],select[name],textarea[name]").each((_, element) => {
    const control = $(element);
    const type = control.attr("type") || "";
    if (control.is(":disabled") || /^(submit|button|reset|file)$/i.test(type)
      || (/^(checkbox|radio)$/i.test(type) && !control.is(":checked"))) return;
    fields[control.attr("name")!] = String(control.val() ?? "");
  });
  return { $, url: url.toString(), fields };
}

export function detailText(html: string) {
  const $ = load(html);
  $("script,style").remove();
  return $("tr").toArray().filter(row => !$(row).find("tr").length)
    .map(row => $(row).find("td,th").toArray().map(cell => $(cell).text().replace(/\s+/g, " ").trim()).join("\t")).join("\n");
}

export function requiresVerification(html: string) {
  // This is a query gate in the site's own script, not merely a hidden widget.
  return /function\s+captchaCheck\s*\(\)\s*\{\s*if\s*\(true\)/.test(html)
    || /<title[^>]*>\s*(?:Just a moment|Access Denied)/i.test(html);
}

type Criteria = { origin: string; destination: string; originCode: string; destinationCode: string; date: string };

export async function queryOoclHttp(criteria: Criteria, existing?: { http: APIRequestContext; html: string; url: string; fields?: Record<string, string> }) {
  const http = existing?.http || await request.newContext({ userAgent: MOBILE_UA });
  const deadline = Date.now() + 150000;
  const warnings: string[] = [];
  const timeout = () => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("OOCL_HTTP_TIMEOUT");
    return Math.min(10000, remaining);
  };
  const read = async (response: import("playwright").APIResponse, stage: string) => {
    if (!response.ok()) throw new Error(`OOCL_${response.status() === 429 ? "RATE_LIMITED" : response.status() === 403 ? "ACCESS_BLOCKED" : "HTTP_FAILED"}: ${stage} HTTP ${response.status()}`);
    return { html: await response.text(), url: response.url() };
  };
  try {
    let current = existing || await read(await http.get(OOCL_MOBILE_URL, { timeout: timeout() }), "entry");
    if (!existing && requiresVerification(current.html)) throw new Error("OOCL_VERIFICATION_REQUIRED: HTTP entry requires browser verification");
    const submit = async (page: { html: string; url: string }, overrides: Record<string, string>) => {
      const form = readForm(page.html, page.url);
      // Browser input/select properties may differ from serialized HTML attributes.
      const fields = page === existing && existing.fields ? existing.fields : form.fields;
      return read(await http.post(form.url, { form: { ...fields, ...overrides }, timeout: timeout(),
        headers: { Referer: page.url, Origin: new URL(page.url).origin } }), "form-submit");
    };
    if (!existing) current = await submit(current, {
      "form:origin_city": criteria.origin, "form:dest_city": criteria.destination,
      "form:sailingWeek": "4", "form:sailinglDate": criteria.date,
      "form:departureOrNot": "true", "form:goToOriginList": "Search", "form:_link_hidden_": "",
    });
    for (let step = 0; step < 3; step++) {
      const { $ } = readForm(current.html, current.url);
      $("script,style").remove();
      if (/no\s+results?\s+(?:(?:were|was|are)\s+)?found/i.test($("body").text())) return { texts: [], warnings: ["NO_SCHEDULE_FOUND"] };
      const links = $("a").toArray().filter(a => /^\s*Details\s*$/i.test($(a).text()));
      if (links.length) {
        const texts: string[] = [];
        for (const link of links) {
          const index = $(link).attr("onclick")?.match(/toDetail\((\d+)\)/)?.[1];
          try {
            if (index === undefined || !$(link).attr("id")) throw new Error("OOCL_HTTP_RESPONSE_INVALID: detail link changed");
            const detail = await submit(current, { "form:_link_hidden_": $(link).attr("id")!, "form:recordIndex": index });
            texts.push(detailText(detail.html));
          } catch (error) {
            const reason = error instanceof Error ? error.message.split("\n")[0] : "request failed";
            warnings.push(`OOCL_DETAIL_FAILED: detail ${index ?? "unknown"}: ${reason}`);
            if (/RATE_LIMITED|ACCESS_BLOCKED|VERIFICATION_REQUIRED|closed/i.test(reason) || Date.now() >= deadline) {
              if (!texts.length) throw error;
              break;
            }
          }
        }
        if (!texts.length && warnings.length) throw new Error(warnings[0]);
        return { texts, warnings };
      }
      let selected = false;
      for (const link of $("a[onclick]").toArray()) {
        const match = $(link).attr("onclick")?.match(/select(Origin|Destination)\('([^']*)','([^']*)','([^']*)'\)/);
        if (!match) continue;
        const origin = match[1] === "Origin";
        if (match[2] !== (origin ? criteria.originCode : criteria.destinationCode)) continue;
        const prefix = origin ? "origin" : "dest";
        current = await submit(current, { "form:_link_hidden_": $(link).attr("id")!,
          [`form:${prefix}_city_id`]: match[2], [`form:${prefix}_city`]: match[3], [`form:${prefix}_city_key`]: match[4] });
        selected = true;
        break;
      }
      if (!selected) {
        const codes = $("a[onclick]").toArray().map(link => $(link).attr("onclick")?.match(/select(?:Origin|Destination)\('([^']*)'/)?.[1]).filter(Boolean);
        if (process.env.SCHEDULE_DEBUG === "true") console.info("OOCL unexpected public page", $("body").text().replace(/\s+/g," ").trim().slice(0,2000));
        throw new Error(`OOCL_HTTP_RESPONSE_INVALID: step=${step} expected city or results missing; offered=${codes.slice(0,12).join(",") || "none"}`);
      }
    }
    throw new Error("OOCL_HTTP_RESPONSE_INVALID: too many form transitions");
  } finally { if (!existing) await http.dispose(); }
}

// Match the official link's location code, not a same-name city or a hidden page.
export function ooclCitySelector(kind: "Origin" | "Destination", code: string) {
  if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(code)) throw new Error("OOCL_PORT_NOT_FOUND: invalid location code");
  return `a[onclick*="select${kind}('${code}',"]:visible`;
}
