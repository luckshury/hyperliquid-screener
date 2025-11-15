import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";

const hydromancerApiKey = secret("HydromancerApiKey");

interface AnalyticsRequest {
  type: string;
  [key: string]: any;
}

interface AnalyticsResponse {
  [key: string]: any;
}

const API_BASE = 'https://api.hydromancer.xyz';

// Encore API endpoint for analytics
export const analytics = api(
  { method: "POST", path: "/analytics" },
  async (req: AnalyticsRequest): Promise<AnalyticsResponse> => {
    try {
      const response = await fetch(`${API_BASE}/info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hydromancerApiKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(req)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Analytics API error:', error);
      throw error;
    }
  }
);

