import type { Page } from "playwright";
import type { PublicScheduleInput } from "../public-http";
import { canonicalPortCode } from "@/features/ports/server/source-port-match";
export async function querySitcBrowser(page:Page,input:PublicScheduleInput,from:string,to:string,transit:boolean){
 await page.goto("https://ebusiness.sitcline.com/#/topMenu/voyagePlanSearch",{waitUntil:"load",timeout:30000});
 for(const [index,port] of [input.originPort,input.destinationPort].entries()){
  const field=page.locator('input[name="port"]').nth(index);await field.click();
  const name=port.name.split(",")[0].replace(/\s+(?:Pt\.?|City)$/i,"");
  const lookup=page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname.endsWith("/queryListPort") && u.searchParams.get("portName")?.replaceAll("%","").toLowerCase()===name.toLowerCase();},{timeout:12000});
  void lookup.catch(()=>undefined);
  await field.pressSequentially(name,{delay:100});
  const lookupResponse=await lookup;
  if(!lookupResponse.ok())throw new Error("ACCESS_BLOCKED: SITC location lookup HTTP "+lookupResponse.status());
  const locations=await lookupResponse.json();
  if(Array.isArray(locations.data?.records)&&!locations.data.records.some((p:{portCode:string})=>canonicalPortCode(p.portCode)===canonicalPortCode(port.locode)))throw new Error("PORT_NOT_FOUND: "+canonicalPortCode(port.locode));
  await page.getByText(canonicalPortCode(port.locode),{exact:true}).click();
 }
 const weeks=Math.ceil((Date.parse(to)-Date.parse(from))/604800000);
 if(weeks<1||weeks>4)throw new Error("BROWSER_RANGE_UNSUPPORTED: SITC form supports one to four weeks");
 await page.getByPlaceholder("Start Date").fill(from);await page.getByPlaceholder("Start Date").press("Tab");
 await page.getByPlaceholder("请选择时间范围").click();await page.getByText("+ "+weeks+" "+(weeks===1?"Week":"Weeks"),{exact:true}).click();
 if(transit)await page.getByText("Transfer",{exact:true}).click();
 const endpoint=transit?"searchTsPlan":"searchPlan";
 const waiting=page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname.endsWith("/"+endpoint)&&u.searchParams.get("datefrom")===from;},{timeout:25000});
 void waiting.catch(()=>undefined);
 await page.getByRole("button",{name:"Search",exact:true}).click();
 const response=await waiting;if(!response.ok())throw new Error("ACCESS_BLOCKED: SITC browser HTTP "+response.status());
 const data=await response.json();if(!data.success||!Array.isArray(data.data?.list))throw new Error("RESPONSE_INVALID: SITC browser schedule list missing");
 await page.waitForFunction(()=>!document.querySelector(".el-loading-mask"),{},{timeout:4000}).catch(()=>undefined);
 const browserRows=await page.locator(".el-table__body-wrapper:visible tr.el-table__row:visible").count();
 // Transfer results use a different layout; a zero direct-table count is not evidence of missing transfer rows.
 return Object.assign(data.data.list,transit?{}:{browserRows});
}
