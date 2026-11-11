import type { Page } from "playwright";
import type { PublicScheduleInput } from "../public-http";
import { canonicalPortCode } from "@/features/ports/server/source-port-match";
export async function queryPilBrowser(page:Page,input:PublicScheduleInput,from:string,to:string){
 let stage="open";try {
 await page.goto("https://www.pilship.com/digital-solutions/?tab=customer&id=schedules",{waitUntil:"load",timeout:30000});
 await page.locator("#CybotCookiebotDialogBodyButtonDecline").click({timeout:3000}).catch(()=>undefined);
 await page.waitForTimeout(3000);
 for(let attempt=0;attempt<3&&!await page.locator('a[href="#pointToPoint"]:visible').count();attempt++){await page.locator("#schedules").click();await page.waitForTimeout(2000);}
 stage="point-to-point tab";await page.locator('a[href="#pointToPoint"]:visible').click();
 const form=page.locator("#pointToPoint");
 for(const [side,port] of [["origin",input.originPort],["destination",input.destinationPort]] as const){
  stage="select "+side;await form.locator(".ds-schedules-"+side+"-port-code-dropdown-search-container").click();
  const code=canonicalPortCode(port.locode);const option=form.locator('.ddsw:visible a[id="'+code+'"]');
  if(!await option.count())throw new Error("PORT_NOT_FOUND: PIL browser official location "+code);
  await option.click();
 }
 for(const [suffix,value] of [["",from],["To",to]]){
  stage="date "+value;await form.locator(suffix?".p2pdetail-date-to-dropdown-container":".p2pdetail-date-from-dropdown-container").click();
  const calendar=form.locator("#detailPointToPointDatePicker"+suffix+" .datepicker-days");
  const stamp=Date.parse(value+"T00:00:00Z");const day=calendar.locator('td.day[data-date="'+stamp+'"]:not(.disabled)');
  for(let month=0;month<24&&!await day.count();month++){
   const visible=Number(await calendar.locator("td.day:not(.old):not(.new)").first().getAttribute("data-date"));
   await calendar.locator(stamp<visible?"th.prev":"th.next").click();
  }
  await day.click();
 }
 const pending=page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname.endsWith("/schedules-point2point.php")&&u.searchParams.get("p2p_selectedstartdate")===from&&u.searchParams.get("p2p_selectedenddate")===to;},{timeout:25000});
 void pending.catch(()=>undefined);
 stage="submit";await page.locator("#sptopSubmitBtn").click();const response=await pending;
 if(!response.ok())throw new Error("ACCESS_BLOCKED: PIL browser HTTP "+response.status());
 const text=await response.text();if(text.trim()==="No data available")return {success:true,schedulePointToPoint:{main:"No data available"}};
 const data=JSON.parse(text);if(!data.success)throw new Error("RESPONSE_INVALID: PIL browser request rejected");
 await page.locator("#table_p2p").waitFor({state:"attached",timeout:5000});
 data.browserRows=await page.locator('#table_p2p tr[id^="schedule_"]').count();
 return data;
 }catch(error){throw new Error("PIL_BROWSER_"+stage+": "+(error instanceof Error?error.message.split("\n")[0]:"failed"));}
}
