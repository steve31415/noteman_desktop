export interface Env {
  DB: D1Database;
  NOTION_TOKEN: string;
  AUTH_PASSWORD: string;
}

export interface PageInfo {
  id: string;
  title: string;
}

export interface RecentPage {
  page_id: string;
  page_title: string;
  last_used: string;
}

export interface WhitelistPage {
  page_id: string;
  page_title: string;
}
