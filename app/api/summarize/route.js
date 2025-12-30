import { getSubtitles } from 'youtube-captions-scraper';
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

export async function POST(request) {
  try {
    const { url } = await request.json();

    // Validate URL
    if (!url || typeof url !== 'string') {
      return Response.json(
        { error: 'Please provide a YouTube URL' }, 
        { status: 400 }
      );
    }

    // Extract video ID
    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      return Response.json(
        { error: 'Invalid YouTube URL. Please use a valid YouTube link.' }, 
        { status: 400 }
      );
    }

    // Fetch transcript using youtube-captions-scraper
    let transcript;
    try {
      // Try English first, then auto-generated
      let captions;
      try {
        captions = await getSubtitles({ videoID: videoId, lang: 'en' });
      } catch {
        // Try auto-generated English captions
        try {
          captions = await getSubtitles({ videoID: videoId, lang: 'en', type: 'auto' });
        } catch {
          // Try without specifying language
          captions = await getSubtitles({ videoID: videoId });
        }
      }
      
      if (!captions || captions.length === 0) {
        throw new Error('No captions found');
      }
      
      transcript = captions.map(item => item.text).join(' ');
    } catch (transcriptError) {
      console.error('Transcript error:', transcriptError);
      return Response.json(
        { error: 'Could not get video transcript. The video may not have captions enabled, may be private, age-restricted, or the captions are disabled by the creator.' }, 
        { status: 400 }
      );
    }

    // Validate transcript
    if (!transcript || transcript.length < 50) {
      return Response.json(
        { error: 'Transcript is too short or empty. The video may not have enough spoken content.' }, 
        { status: 400 }
      );
    }

    // Clean transcript (remove [Music], [Applause], etc.)
    const cleanedTranscript = transcript
      .replace(/\[.*?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Truncate transcript for API limits
    const maxLength = 6000;
    const truncatedTranscript = cleanedTranscript.length > maxLength 
      ? cleanedTranscript.slice(0, maxLength) + '...' 
      : cleanedTranscript;

    // Create prompt for Hugging Face
    const prompt = `<s>[INST] You are a helpful assistant that creates concise summaries of YouTube videos.

Your task: Summarize the following video transcript in 3-5 clear bullet points.
- Focus on the main ideas and key takeaways
- Keep each point brief but informative
- Use simple, easy-to-understand language

Transcript:
${truncatedTranscript}

Provide only the bullet point summary, nothing else. [/INST]`;

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
        { error: 'AI service temporarily unavailable. Please try again in a moment.' }, 
        { status: 503 }
      );
    }

    // Extract and clean summary
    const summary = response.generated_text
      .trim()
      .replace(/^(Here'?s?|The|This|A) (is )?(a )?(summary|video|transcript)[:\s]*/i, '')
      .trim();

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
