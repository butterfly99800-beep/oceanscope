import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const CSV_PATH = process.env.PORTS_DATA_FILE || process.argv[2];
if (!CSV_PATH || process.env.OCEANSCOPE_IMPORT_PORTS !== "true") throw new Error("Set PORTS_DATA_FILE and OCEANSCOPE_IMPORT_PORTS=true explicitly; no data has been changed.");

// ---------- 大洲 -> 区域（按已确认方案） ----------
const CONTINENT_REGION = {
  AS: "Asia",
  EU: "Europe",
  AM: "Americas",
  AF: "Africa",
  AU: "Oceania",
};
const UNCLASSIFIED = "Unclassified";

// ---------- ISO 3166-1 alpha-2 -> 英文国名（覆盖 CSV 全部 175 个国家代码） ----------
const COUNTRY_NAMES = {
  AE:"United Arab Emirates",AG:"Antigua and Barbuda",AL:"Albania",AO:"Angola",AR:"Argentina",AS:"American Samoa",AU:"Australia",AW:"Aruba",
  BB:"Barbados",BD:"Bangladesh",BE:"Belgium",BG:"Bulgaria",BH:"Bahrain",BJ:"Benin",BM:"Bermuda",BN:"Brunei Darussalam",BQ:"Bonaire, Sint Eustatius and Saba",BR:"Brazil",BS:"Bahamas",BZ:"Belize",
  CA:"Canada",CD:"DR Congo",CG:"Congo",CI:"Côte d'Ivoire",CL:"Chile",CM:"Cameroon",CN:"China",CO:"Colombia",CR:"Costa Rica",CU:"Cuba",CV:"Cabo Verde",CW:"Curaçao",CY:"Cyprus",
  DE:"Germany",DJ:"Djibouti",DK:"Denmark",DM:"Dominica",DO:"Dominican Republic",DZ:"Algeria",
  EC:"Ecuador",EE:"Estonia",EG:"Egypt",ER:"Eritrea",ES:"Spain",
  FI:"Finland",FJ:"Fiji",FK:"Falkland Islands",FR:"France",
  GA:"Gabon",GB:"United Kingdom",GD:"Grenada",GE:"Georgia",GF:"French Guiana",GH:"Ghana",GI:"Gibraltar",GL:"Greenland",GM:"Gambia",GN:"Guinea",GP:"Guadeloupe",GQ:"Equatorial Guinea",GR:"Greece",GT:"Guatemala",GU:"Guam",GW:"Guinea-Bissau",GY:"Guyana",
  HK:"Hong Kong, China",HN:"Honduras",HR:"Croatia",HT:"Haiti",
  ID:"Indonesia",IE:"Ireland",IL:"Israel",IN:"India",IQ:"Iraq",IR:"Iran",IS:"Iceland",IT:"Italy",
  JM:"Jamaica",JO:"Jordan",JP:"Japan",
  KE:"Kenya",KH:"Cambodia",KI:"Kiribati",KM:"Comoros",KN:"Saint Kitts and Nevis",KP:"North Korea",KR:"South Korea",KW:"Kuwait",KY:"Cayman Islands",
  LB:"Lebanon",LC:"Saint Lucia",LK:"Sri Lanka",LR:"Liberia",LT:"Lithuania",LV:"Latvia",LY:"Libya",
  MA:"Morocco",ME:"Montenegro",MG:"Madagascar",MM:"Myanmar",MO:"Macao, China",MP:"Northern Mariana Islands",MQ:"Martinique",MR:"Mauritania",MT:"Malta",MU:"Mauritius",MV:"Maldives",MX:"Mexico",MY:"Malaysia",MZ:"Mozambique",
  NA:"Namibia",NC:"New Caledonia",NG:"Nigeria",NI:"Nicaragua",NL:"Netherlands",NO:"Norway",NU:"Niue",NZ:"New Zealand",
  OM:"Oman",
  PA:"Panama",PE:"Peru",PF:"French Polynesia",PG:"Papua New Guinea",PH:"Philippines",PK:"Pakistan",PL:"Poland",PR:"Puerto Rico",PT:"Portugal",PW:"Palau",PY:"Paraguay",
  QA:"Qatar",
  RE:"Réunion",RO:"Romania",RU:"Russia",
  SA:"Saudi Arabia",SB:"Solomon Islands",SC:"Seychelles",SD:"Sudan",SE:"Sweden",SG:"Singapore",SH:"Saint Helena",SI:"Slovenia",SL:"Sierra Leone",SN:"Senegal",SO:"Somalia",SR:"Suriname",ST:"São Tomé and Príncipe",SV:"El Salvador",SX:"Sint Maarten",SY:"Syria",
  TC:"Turks and Caicos Islands",TG:"Togo",TH:"Thailand",TL:"Timor-Leste",TN:"Tunisia",TO:"Tonga",TR:"Turkey",TT:"Trinidad and Tobago",TV:"Tuvalu",TW:"Taiwan, China",TZ:"Tanzania",
  UA:"Ukraine",US:"United States",UY:"Uruguay",
  VC:"Saint Vincent and the Grenadines",VE:"Venezuela",VG:"British Virgin Islands",VI:"United States Virgin Islands",VN:"Vietnam",VU:"Vanuatu",
  WF:"Wallis and Futuna",WS:"Samoa",
  YE:"Yemen",YT:"Mayotte",
  ZA:"South Africa",
};

// ---------- 简易 CSV 解析器（支持引号、内嵌逗号/换行、""转义） ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
      row = []; field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const MISSING = "待补充";
const empty = (v) => !v || v.trim() === "" || v.trim() === MISSING;

// 从验证记录里恢复 COSCO/OOCL 长数字 ID（已实测 897/897、802/802 可恢复）
function idFromNote(note) {
  const m = String(note || "").match(/id=(\d{10,})/);
  return m ? m[1] : null;
}

const carriers = [
  { code: "ONE", name: "ONE", nameZh: "海洋网联船务", country: "Singapore" },
  { code: "COSCO", name: "COSCO SHIPPING", nameZh: "中远海运", country: "China" },
  { code: "OOCL", name: "OOCL", nameZh: "东方海外", country: "Hong Kong" },
  { code: "CMA", name: "CMA CGM", nameZh: "达飞轮船", country: "France" },
  { code: "MAERSK", name: "Maersk", nameZh: "马士基", country: "Denmark" },
  { code: "MSC", name: "MSC Mediterranean Shipping Company", nameZh: "地中海航运", country: "Switzerland" },
  { code: "HAPAG", name: "Hapag-Lloyd", nameZh: "赫伯罗特", country: "Germany" },
];

const prisma = new PrismaClient();

try {
  const raw = readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
  const table = parseCsv(raw);
  const headers = table[0].map((h) => h.trim());
  const idx = (name) => headers.indexOf(name);
  const col = {
    name: idx("港口英文名"), nameZh: idx("港口中文名"), locode: idx("UN/LOCODE"),
    countryCode: idx("国家地区代码"), continent: idx("HAPAG 大洲代码"),
    coscoId: idx("COSCO 城市 ID"), coscoNote: idx("COSCO 验证截图/记录"),
    ooclId: idx("OOCL 地点 ID"), ooclNote: idx("OOCL 验证截图/记录"),
    ooclSearchName: idx("OOCL 搜索词"),
    hapagLocode: idx("HAPAG 业务 LOCODE"),
    maerskGeo: idx("Maersk Geo ID"), maerskRkst: idx("Maersk RKST 代码"),
    cmaLocode: idx("CMA LOCODE"),
    mscPortId: idx("MSC 港口 ID"), mscCountryId: idx("MSC 国家 ID"), mscLocode: idx("MSC 系统 LOCODE"),
  };
  for (const [k, v] of Object.entries(col)) if (v < 0) throw new Error(`CSV missing column: ${k}`);

  const validRows = table.slice(1).filter(r => r.some(v => v.trim()));
  for (const r of validRows) {
    if (r.length !== headers.length || !/^[A-Z]{2}[A-Z0-9]{3}$/.test((r[col.locode] || "").trim().toUpperCase()) || !(r[col.name] || "").trim()) throw new Error("Invalid CSV row; import stopped before any database write.");
  }
  if (!validRows.length) throw new Error("CSV has no port records.");

  // 1) 载入/创建 Carrier
  const carrierMap = {};
  for (const c of carriers) {
    const row = await prisma.carrier.upsert({
      where: { code: c.code },
      update: {},
      create: { code: c.code, name: c.name, nameZh: c.nameZh, country: c.country },
    });
    carrierMap[c.code] = row.id;
  }
  console.log("Carriers ready:", Object.keys(carrierMap).join(", "));

  // Existing port mappings are preserved; missing mappings are added only.

  // 3) 逐行导入 Port + Mapping
  let portsUpserted = 0, portRows = 0, skippedLocode = 0;
  const mappingStats = { COSCO: 0, OOCL: 0, HAPAG: 0, MAERSK: 0, MSC: 0, CMA: 0 };
  const mappingGap = { COSCO: 0, OOCL: 0, HAPAG: 0, MAERSK: 0, MSC: 0, CMA: 0 };

  for (const r of table.slice(1)) {
    if (!r || r.length < headers.length) continue;
    const locode = (r[col.locode] || "").trim().toUpperCase();
    if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(locode)) { skippedLocode++; continue; }
    portRows++;

    let countryCode = (r[col.countryCode] || "").trim().toUpperCase();
    if (empty(countryCode)) countryCode = locode.slice(0, 2); // UN/LOCODE 前两位即国家码
    const countryName = COUNTRY_NAMES[countryCode] || countryCode;

    const continent = (r[col.continent] || "").trim().toUpperCase();
    const region = CONTINENT_REGION[continent] || UNCLASSIFIED;

    const name = (r[col.name] || "").trim();
    const nameZh = (r[col.nameZh] || "").trim();
    const aliases = [name, nameZh, locode, `${name} Port`].filter(Boolean);

    const port = await prisma.port.upsert({
      where: { locode },
      update: {},
      create: { name, nameZh, locode, country: countryName, countryCode, region, aliases },
    });
    portsUpserted++;

    // 4) 各船司映射（待补充/空 一律跳过，不猜值）
    const upsertMap = async (carrierCode, codeType, value) => {
      if (empty(value)) { mappingGap[carrierCode]++; return; }
      await prisma.carrierPortMapping.upsert({
        where: { carrierId_portId_codeType: { carrierId: carrierMap[carrierCode], portId: port.id, codeType } },
        update: {},
        create: { carrierId: carrierMap[carrierCode], portId: port.id, codeType, mappingValue: value.trim() },
      });
      mappingStats[carrierCode]++;
    };

    // COSCO：CITY_UUID 从验证记录恢复（科学计数法已丢精度）
    const coscoUuid = idFromNote(r[col.coscoNote]);
    await upsertMap("COSCO", "CITY_UUID", coscoUuid);

    // OOCL：LOCATION_ID 从验证记录恢复；SEARCH_NAME 用官方搜索词（OOCL 表单关键词）
    const ooclId = idFromNote(r[col.ooclNote]);
    await upsertMap("OOCL", "LOCATION_ID", ooclId);
    await upsertMap("OOCL", "SEARCH_NAME", r[col.ooclSearchName]);

    // HAPAG
    await upsertMap("HAPAG", "LOCODE", r[col.hapagLocode]);
    // Maersk
    await upsertMap("MAERSK", "GEOID", r[col.maerskGeo]);
    await upsertMap("MAERSK", "RKST", r[col.maerskRkst]);
    // CMA
    await upsertMap("CMA", "LOCODE", r[col.cmaLocode]);
    // MSC
    await upsertMap("MSC", "PORT_ID", r[col.mscPortId]);
    await upsertMap("MSC", "COUNTRY_ID", r[col.mscCountryId]);
    await upsertMap("MSC", "LOCODE", r[col.mscLocode]);
  }

  console.log(`\nPort rows read: ${portRows} | skipped(bad locode): ${skippedLocode} | upserted: ${portsUpserted}`);
  console.log("Mappings inserted per carrier:");
  for (const c of carriers) {
    console.log(`  ${c.code.padEnd(6)} inserted=${mappingStats[c.code]} skipped(待补/空)=${mappingGap[c.code]}`);
  }
} catch (e) {
  console.error("Port import failed; existing data was not deleted. Check the reviewed CSV and database configuration.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
