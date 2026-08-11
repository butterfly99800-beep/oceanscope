export type ScheduleSearchOptions = {
  dateFrom: string;
  dateTo?: string;
  directOnly?: boolean;
};

export type ProviderScheduleResult = {
  providerCode: string;
  rawCount: number;
  savedCount?: number;
};

export interface ShippingProvider<TSearchInput = unknown, TResult = ProviderScheduleResult> {
  readonly code: string;
  searchSchedule(input: TSearchInput): Promise<TResult>;
}
