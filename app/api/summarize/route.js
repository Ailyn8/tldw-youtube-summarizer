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

async function getTranscript(videoId) {
  // Fetch the video page to get caption tracks
  const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!videoPageResponse.ok) {
    throw new Error('Failed to fetch video page');
  }

  const html = await videoPageResponse.text();

  // Extract captions URL from the page
  const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
  if (!captionMatch) {
    throw new Error('No captions available for this video');
  }

  let captionTracks;
  try {
    captionTracks = JSON.parse(captionMatch[1]);
  } catch {
    throw new Error('Failed to parse caption data');
  }

  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('No caption tracks found');
  }

  // Prefer English captions
  let captionUrl = captionTracks.find(t => t.languageCode === 'en')?.baseUrl;
  if (!captionUrl) {
    captionUrl = captionTracks[0]?.baseUrl;
  }

  if (!captionUrl) {
    throw new Error('No caption URL found');
  }

  // Fetch the captions XML
  const captionResponse = await fetch(captionUrl);
  if (!captionResponse.ok) {
    throw new Error('Failed to fetch captions');
  }

  const captionXml = await captionResponse.text();

  // Parse the XML to extract text
  const textMatches = captionXml.matchAll(/<text[^>]*>(.*?)<\/text>/gs);
  const texts = [];
  
  for (const match of textMatches) {
    let text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]*>/g, '')
      .trim();
    
    if (text) {
      texts.push(text);
    }
  }

  return texts.join(' ');
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

    // Fetch transcript
    let transcript;
    try {
      transcript = await getTranscript(videoId);
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
