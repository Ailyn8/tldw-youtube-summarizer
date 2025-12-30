function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
    /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getTranscriptFromRapidAPI(videoId) {
  const response = await fetch(
    `https://youtube-transcriptor.p.rapidapi.com/transcript?video_id=${videoId}&lang=en`,
    {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'youtube-transcriptor.p.rapidapi.com',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch transcript');
  }

  const data = await response.json();
  
  if (Array.isArray(data) && data.length > 0) {
    if (data[0].transcriptionAsText) {
      return data[0].transcriptionAsText;
    }
    if (data[0].text) {
      return data.map(item => item.text).join(' ');
    }
  }
  
  if (data.transcription) return data.transcription;
  if (data.transcript) {
    if (typeof data.transcript === 'string') return data.transcript;
    if (Array.isArray(data.transcript)) {
      return data.transcript.map(item => item.text || '').join(' ');
    }
  }

  throw new Error('No transcript found');
}

async function summarizeText(transcript, apiKey) {
  // Using a summarization model directly (more reliable for this task)
  const response = await fetch(
    'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: transcript,
        parameters: {
          max_length: 300,
          min_length: 50,
          do_sample: false,
        },
        options: {
          wait_for_model: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('HF API error:', response.status, errorText);
    throw new Error(`Hugging Face API error: ${response.status}`);
  }

  const result = await response.json();
  
  if (Array.isArray(result) && result[0]?.summary_text) {
    return result[0].summary_text;
  }
  
  if (result.summary_text) {
    return result.summary_text;
  }

  throw new Error('Unexpected response format');
}

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return Response.json(
        { error: 'Please provide a YouTube URL' }, 
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      return Response.json(
        { error: 'Invalid YouTube URL.' }, 
        { status: 400 }
      );
    }

    if (!process.env.RAPIDAPI_KEY) {
      return Response.json(
        { error: 'RAPIDAPI_KEY not configured.' }, 
        { status: 500 }
      );
    }

    if (!process.env.HUGGINGFACE_API_KEY) {
      return Response.json(
        { error: 'HUGGINGFACE_API_KEY not configured.' }, 
        { status: 500 }
      );
    }

    // Get transcript
    let transcript;
    try {
      transcript = await getTranscriptFromRapidAPI(videoId);
    } catch (err) {
      return Response.json(
        { error: 'Could not get transcript. Video may not have captions.' }, 
        { status: 400 }
      );
    }

    if (!transcript || transcript.length < 50) {
      return Response.json(
        { error: 'Transcript too short.' }, 
        { status: 400 }
      );
    }

    // Clean and limit transcript (BART model has 1024 token limit)
    const cleanedTranscript = transcript
      .replace(/\[.*?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    // Summarize
    let summary;
    try {
      summary = await summarizeText(cleanedTranscript, process.env.HUGGINGFACE_API_KEY);
    } catch (err) {
      console.error('Summarization error:', err.message);
      return Response.json(
        { error: 'AI summarization failed. Please try again in a moment.' }, 
        { status: 503 }
      );
    }

    // Format as bullet points
    const sentences = summary.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    const bulletPoints = sentences.map(s => `• ${s.trim()}`).join('\n');

    return Response.json({ summary: bulletPoints });

  } catch (error) {
    console.error('Error:', error);
    return Response.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
