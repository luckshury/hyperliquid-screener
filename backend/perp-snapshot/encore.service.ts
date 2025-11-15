import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const hydromancerApiKey = secret("HydromancerApiKey");

interface PerpSnapshotRequest {
  type: string;
  market_names?: string[];
}

interface PerpSnapshotResponse {
  data?: ArrayBuffer;
  headers?: {
    payloadFormat?: string;
    contentEncoding?: string;
    compression?: string;
  };
  [key: string]: any;
}

const API_BASE = 'https://api.hydromancer.xyz';

// Encore API endpoint for perpetual snapshot data
export const perpSnapshot = api(
  { method: "POST", path: "/perp-snapshot" },
  async (req: PerpSnapshotRequest): Promise<PerpSnapshotResponse> => {
    try {
      const { type, market_names } = req;

      console.log('📡 Perp Snapshot API - Request:', { type, market_names });

      const response = await fetch(`${API_BASE}/info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hydromancerApiKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          market_names
        })
      });

      console.log('📡 Hydromancer API Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Hydromancer API Error:', response.status, errorText);
        throw APIError.unavailable(`API request failed: ${response.status} - ${errorText}`);
      }

      // Check if it's a timestamp request (JSON response)
      if (type === 'perpSnapshotTimestamp') {
        const data = await response.json();
        return data;
      }

      // For snapshot data (binary response)
      const arrayBuffer = await response.arrayBuffer();
      const payloadFormat = response.headers.get('x-payload-format');
      const contentEncoding = response.headers.get('content-encoding');
      const xCompression = response.headers.get('x-compression');

      return {
        data: arrayBuffer,
        headers: {
          payloadFormat: payloadFormat || undefined,
          contentEncoding: contentEncoding || undefined,
          compression: xCompression || undefined
        }
      };
    } catch (error) {
      console.error('Perp snapshot API error:', error);
      throw error;
    }
  }
);

