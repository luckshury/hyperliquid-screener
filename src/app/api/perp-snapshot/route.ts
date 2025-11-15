import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.NEXT_PUBLIC_HYDROMANCER_API_KEY || '';
const API_BASE = process.env.NEXT_PUBLIC_HYDROMANCER_URL || 'https://api.hydromancer.xyz';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, market_names } = body;

    console.log('📡 Perp Snapshot API Route - Request:', { type, market_names });

    const response = await fetch(`${API_BASE}/info`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
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
      return NextResponse.json(
        { error: `API request failed: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // Check if it's a timestamp request (JSON response)
    if (type === 'perpSnapshotTimestamp') {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // For snapshot data (binary response)
    const arrayBuffer = await response.arrayBuffer();
    const payloadFormat = response.headers.get('x-payload-format');
    const contentEncoding = response.headers.get('content-encoding');
    const xCompression = response.headers.get('x-compression');

    // Return binary data with headers
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-payload-format': payloadFormat || '',
        'content-encoding': contentEncoding || '',
        'x-compression': xCompression || ''
      }
    });
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

