import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

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
    const errorText = await response.text();
    console.error('RapidAPI error:', errorText);
    throw new Error('Failed to fetch transcript');
  }

  const data = await response.json();
  
  // Handle different response formats
  if (Array.isArray(data) && data.length > 0) {
    // Format: [{ transcriptionAsText: "..." }] or [{ text: "..." }]
    if (data[0].transcriptionAsText) {
      return data[0].transcriptionAsText;
    }
    if (data[0].text) {
      return data.map(item => item.text).join(' ');
    }
    // Format: array of transcript segments
    if (data[0].subtitle) {
      return data.map(item => item.subtitle).join(' ');
    }
  }
  
  if (data.transcription) {
    return data.transcription;
  }
  
  if (data.transcript) {
    if (typeof data.transcript === 'string') {
      return data.transcript;
    }
    if (Array.isArray(data.transcript)) {
      return data.transcript.map(item => item.text || item.subtitle || '').join(' ');
    }
  }

  throw new Error('Unexpected transcript format');
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
        { error: 'Invalid YouTube URL. Please use a valid YouTube link.' }, 
        { status: 400 }
      );
    }

    // Check if RapidAPI key is configured
    if (!process.env.RAPIDAPI_KEY) {
      return Response.json(
        { error: 'API not configured. Please add RAPIDAPI_KEY to environment variables.' }, 
        { status: 500 }
      );
    }

    // Fetch transcript using RapidAPI
    let transcript;
    try {
      transcript = await getTranscriptFromRapidAPI(videoId);
    } catch (transcriptError) {
      console.error('Transcript error:', transcriptError.message);
      return Response.json(
        { error: 'Could not get video transcript. The video may not have captions enabled, or it may be private/age-restricted.' }, 
        { status: 400 }
      );
    }

    if (!transcript || transcript.length < 50) {
      return Response.json(
        { error: 'Transcript is too short or empty.' }, 
        { status: 400 }
      );
    }

    // Clean and truncate transcript
    const cleanedTranscript = transcript
      .replace(/\[.*?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const maxLength = 6000;
    const truncatedTranscript = cleanedTranscript.length > maxLength 
      ? cleanedTranscript.slice(0, maxLength) + '...' 
      : cleanedTranscript;

    // Check if Hugging Face key is configured
    if (!process.env.HUGGINGFACE_API_KEY) {
      return Response.json(
        { error: 'AI not configured. Please add HUGGINGFACE_API_KEY to environment variables.' }, 
        { status: 500 }
      );
    }

    // Create prompt for Hugging Face
    const prompt = `<s>[INST] You are a helpful assistant that creates concise summaries of YouTube videos.

Summarize the following video transcript in 3-5 clear bullet points:
- Focus on the main ideas and key takeaways
- Keep each point brief but informative

Transcript:
${truncatedTranscript}

Provide only the bullet point summary. [/INST]`;

    // Call Hugging Face API
    let response;
    try {
      response = await hf.textGeneration({
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          top_p: 0.95,
          return_full_text: false,
          do_sample: true,
        },
      });
    } catch (hfError) {
      console.error('Hugging Face error:', hfError);
      return Response.json(
        { error: 'AI service temporarily unavailable. Please try again.' }, 
        { status: 503 }
      );
    }

    const summary = response.generated_text?.trim();

    if (!summary) {
      return Response.json(
        { error: 'Failed to generate summary. Please try again.' }, 
        { status: 500 }
      );
    }

    return Response.json({ summary });

  } catch (error) {
    console.error('Unexpected error:', error);
    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
