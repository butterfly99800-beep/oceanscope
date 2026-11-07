import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { canonicalPortCode, samePortCode } from "@/features/ports/server/source-port-match";
import { publicProvider, publishedDate, responseText, scheduleId } from "../public-http";
export const YML_PAGE = "https://www.yangming.com/en/esolution/schedule/point_to_point_search";
const API = "https://www.yangming.com/api/P2P/";
type Leg = { locationCodeFrom?: string; locationCodeTo?: string; locationNameFrom?: string; locationNameTo?: string; terminalNameFrom?: string; terminalNameTo?: string; serviceCode?: string; vesselName?: string; comnVoyage?: string; transitMode?: string; etd?: string; eta?: string };
type Route = { placeOfReceiptCode?: string; placeOfDeliveryCode?: string; placeOfReceipt?: string; placeOfDelivery?: string; masterETD?: string; masterETA?: string; transitDays?: number; masterVesselName?: string; masterComnVoyage?: string; routeDetails?: Leg[]; cutoffCY?: string; cutoffSI?: string; blockStatus?: unknown };
export function mapYangMing(payload: unknown, origin: string, destination: string, from: string, to: string): CoscoSchedulePreview[] {
  if (!Array.isArray(payload)) throw new Error("RESPONSE_INVALID: Yang Ming route array missing");
  const schedules: CoscoSchedulePreview[] = [];
  for (const row of payload as Route[]) {
    if (!row.placeOfReceiptCode || !row.placeOfDeliveryCode || !samePortCode(row.placeOfReceiptCode, origin) || !samePortCode(row.placeOfDeliveryCode, destination)) continue;
    const etd = publishedDate(row.masterETD), eta = publishedDate(row.masterETA);
    if (!etd || !eta || etd >= eta || etd.slice(0, 10) < from || etd.slice(0, 10) > to) continue;
    if (!row.placeOfReceipt || !row.placeOfDelivery) continue;
    const legs = row.routeDetails ?? [], sea = legs.filter(leg => leg.transitMode === "VESSEL");
    const exclusivelySea = legs.length > 0 && sea.length === legs.length;
    const vesselName = sea[0]?.vesselName || row.masterVesselName || null;
    const voyageNumber = sea[0]?.comnVoyage || row.masterComnVoyage || null;
    schedules.push({ id: scheduleId("YML", [row.placeOfReceiptCode, row.placeOfDeliveryCode, etd, eta, legs]), carrierName: "YANG MING", originText: row.placeOfReceipt, destinationText: row.placeOfDelivery,
      originLocode: row.placeOfReceiptCode, destinationLocode: row.placeOfDeliveryCode, etd, eta, etdTimeKnown: false, etaTimeKnown: false,
      vesselName, voyageNumber, serviceName: sea[0]?.serviceCode || null, routeName: null,
      transitDays: typeof row.transitDays === "number" && Number.isInteger(row.transitDays) ? row.transitDays : null,
      direct: exclusivelySea ? sea.length === 1 : null, stopCount: exclusivelySea ? sea.length - 1 : null,
      transitPorts: sea.slice(0, -1).map(leg => leg.locationNameTo).filter((name): name is string => Boolean(name)),
      originFacilityName: legs[0]?.terminalNameFrom || null, destinationFacilityName: legs.at(-1)?.terminalNameTo || null,
      cutOffTime: publishedDate(row.cutoffCY), siCutOffTime: publishedDate(row.cutoffSI), availableTime: null,
      rawText: JSON.stringify({ sourceUrl: API + "GetP2PRoutes", officialLegs: legs, row, timeBasis: "official local dates; offset not supplied" }) });
  }
  return Array.from(new Map(schedules.map(row => [row.id, row])).values());
}
export const YMLProvider = publicProvider("YML", YML_PAGE, async (context, input, from, to) => {
  const origin = canonicalPortCode(input.originPort.locode), destination = canonicalPortCode(input.destinationPort.locode);
  for (const [type, code] of [["F", origin], ["T", destination]]) {
    const locations = JSON.parse(await responseText(context, API + "GetLocations?" + new URLSearchParams({ queryType: type, searchByCode: "TRUE", locationName: code, ...(type === "T" ? { locationCodeFrom: origin } : {}) }))) as { locationCode: string }[];
    if (!Array.isArray(locations)) throw new Error("RESPONSE_INVALID: Yang Ming location array missing");
    if (!locations.some(location => location.locationCode === code)) throw new Error(`PORT_NOT_FOUND: official location ${code}`);
  }
  const params = new URLSearchParams({ locationCodeFrom: origin, serviceTermFrom: "Y", locationCodeTo: destination, serviceTermTo: "Y", priorityWay: "ALL", dateDefinition: "DEP", startDate: from.replaceAll("-", ""), endDate: to.replaceAll("-", "") });
  return mapYangMing(JSON.parse(await responseText(context, API + "GetP2PRoutes?" + params)), origin, destination, from, to);
});
