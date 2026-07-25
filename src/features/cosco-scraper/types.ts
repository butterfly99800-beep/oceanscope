export type CoscoScraperErrorCode =
  | "COSCO_SCRAPER_DISABLED"
  | "COSCO_AUTOMATION_BLOCKED"
  | "COSCO_CAPTCHA_REQUIRED"
  | "COSCO_RATE_LIMITED"
  | "COSCO_LOGIN_REQUIRED"
  | "COSCO_SELECTOR_NOT_FOUND"
  | "COSCO_TIMEOUT"
  | "COSCO_NO_RESULTS"
  | "COSCO_UNKNOWN_ERROR";

export type CoscoScheduleCriteria = {
  origin: string;
  destination: string;
  dateFrom: string;
  dateTo?: string;
  originCityUuid?: string;
  destinationCityUuid?: string;
  debug?: boolean;
  forceRefresh?: boolean;
};

export type CoscoCityOption = {
  uuid: string;
  name: string;
  fullName: string;
  locode: string;
  cityCode: string;
  country: string;
};

export type CoscoNetworkProbe = {
  url: string;
  method: string;
  status: number;
  resourceType: string;
  contentType: string | null;
  postData?: string | null;
};

export type CoscoDetectedControl = {
  name: string;
  selector: string;
  placeholder?: string;
  visible: boolean;
};

export type CoscoSchedulePreview = {
  id: string;
  carrierName: string;
  serviceName: string | null;
  routeName: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  originText: string;
  destinationText: string;
  originLocode: string | null;
  destinationLocode: string | null;
  etd: string | null;
  eta: string | null;
  transitDays: number | null;
  direct: boolean | null;
  stopCount: number | null;
  transitPorts: string[];
  cargoNature?: string | null;
  cutOffTime?: string | null;
  availableTime?: string | null;
  originFacilityName?: string | null;
  destinationFacilityName?: string | null;
  outboundHaulage?: string | null;
  inboundHaulage?: string | null;
  rawText: string;
};

export type CoscoScrapeResult = {
  source: "COSCO_LIVE";
  finalUrl: string;
  pageTitle: string;
  entryText: string;
  openedNewPage: boolean;
  iframeUrls: string[];
  targetUrl: string;
  queriedAt: string;
  criteria: CoscoScheduleCriteria;
  schedules: CoscoSchedulePreview[];
  warnings: string[];
  debug: {
    controls: CoscoDetectedControl[];
    network: CoscoNetworkProbe[];
    jsonEndpoints: string[];
    screenshotPath?: string;
    jsonPayloadCount?: number;
  };
  durationMs: number;
  fromCache: boolean;
};

export type CoscoCommitMode = "skipDuplicates" | "updateDuplicates";

export type CoscoCommitResult = {
  created: number;
  updated: number;
  skipped: number;
  skippedItems: Array<{ id: string; reason: string }>;
};
