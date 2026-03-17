import { RestoredData } from '../types';

/**
 * Perform a GET request to Google Sheets webhook to fetch all sync rows
 */
export async function fetchFromSheet(webhookUrl: string): Promise<RestoredData[]> {
  if (!webhookUrl) return [];
  try {
    const res = await fetch(webhookUrl, {
      redirect: 'follow', // Important for Google Apps Script redirects
    });
    const parsed = await res.json();
    return parsed as RestoredData[];
  } catch (error) {
    console.error("Failed to fetch from sheet:", error);
    return [];
  }
}

/**
 * Perform an UPSERT post request for one or many profiles to save changes
 */
export async function upsertToSheet(webhookUrl: string, profiles: RestoredData[]): Promise<boolean> {
  if (!webhookUrl || profiles.length === 0) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Prevent CORS preflight issues with typical fetch
      body: JSON.stringify({ action: 'upsert', profiles })
    });
    return res.ok;
  } catch (error) {
    console.error("Failed to upsert to sheet:", error);
    return false;
  }
}

/**
 * Perform a DELETE post request to remove links from sheet
 */
export async function deleteFromSheet(webhookUrl: string, links: string[]): Promise<boolean> {
  if (!webhookUrl || links.length === 0) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', links })
    });
    return res.ok;
  } catch (error) {
    console.error("Failed to delete from sheet:", error);
    return false;
  }
}
