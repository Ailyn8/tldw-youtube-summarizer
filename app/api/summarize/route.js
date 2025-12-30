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

async function getTranscript(videoId) {
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
    if (data[0].transcriptionAsText) return data[0].transcriptionAsText;
    if (data[0].text) return data.map(item => item.text).join(' ');
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

async function summarizeWithGroq(transcript) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes YouTube videos. Create clear, concise summaries in bullet point format.'
        },
        {
          role: 'user',
          content: `Summarize this YouTube video transcript in 4-6 bullet points. Focus on the main ideas and key takeaways:\n\n${transcript}`
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Groq API error:', response.status, errorData);
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'Please provide a YouTube URL' }, { status: 400 });
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      return Response.json({ error: 'Invalid YouTube URL.' }, { status: 400 });
    }

    // Check API keys
    if (!process.env.RAPIDAPI_KEY) {
      return Response.json({ error: 'RAPIDAPI_KEY not configured.' }, { status: 500 });
    }
    if (!process.env.GROQ_API_KEY) {
      return Response.json({ error: 'GROQ_API_KEY not configured.' }, { status: 500 });
    }

    // Get transcript
    let transcript;
    try {
      transcript = await getTranscript(videoId);
    } catch (err) {
      console.error('Transcript error:', err);
      return Response.json(
        { error: 'Could not get transcript. Video may not have captions enabled.' }, 
        { status: 400 }
      );
    }

    if (!transcript || transcript.length < 50) {
      return Response.json({ error: 'Transcript too short or empty.' }, { status: 400 });
    }

    // Clean and limit transcript
    const cleanedTranscript = transcript
      .replace(/\[.*?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    // Summarize with Groq
    let summary;
    try {
      summary = await summarizeWithGroq(cleanedTranscript);
    } catch (err) {
      console.error('Groq error:', err);
      return Response.json(
        { error: 'AI summarization failed. Please try again.' }, 
        { status: 503 }
      );
    }

    if (!summary) {
      return Response.json({ error: 'Failed to generate summary.' }, { status: 500 });
    }

    return Response.json({ summary });

  } catch (error) {
    console.error('Unexpected error:', error);
    return Response.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
