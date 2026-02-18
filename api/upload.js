import { put } from '@vercel/blob';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // 1. Check if the request is allowed
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 2. Get the file name from headers
    const filename = request.headers.get('x-filename') || 'file.txt';

    // 3. Upload to Vercel Blob (This uses your Environment Variable automatically)
    // Note: Vercel Functions have a size limit (4.5MB). 
    // For larger files, we would need a "Client Token" flow, but this works for presets/small edits.
    const blob = await put(filename, request.body, {
      access: 'public',
    });

    // 4. Send the success URL back to the phone
    return new Response(JSON.stringify(blob), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
