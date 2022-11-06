import { promptTemplate } from '../prompt';

/**
 * Takes a transcription of a call and returns information about the call in JSON
 * @param transcript Call transcription from call
 * @example
 * const callInfo = JSON.stringify( await getCallInfo('Caller: Hello, there!') );
 * @returns JSON string with information about the call
 */
export async function TranscriptToStructuredData(
  transcript: string
): Promise<string> {
  let result =
    '{"resolved?": "' +
    (await promptTemplate(
      `You are a call center manager tasked with reading call transcripts to describe call intent, carefully tracking follow-up action items, whether the underlying issue was resolved (and not just whether action was taken), how important the issue was (issue priority), and customer satisfaction from a transcript.
    These are calls for a company called The Corporation, Inc, and they will be related to doing business. Don't make anything up, just use the transcript to figure out what the user is talking about.

    {{{chunk}}}

    Define a JSON object with the following keys:

    [ "issue summary (string max 128 characters)", "resolved?  (closed, escalated or opened)", "summary of steps either taken or needed for resolution (string)", "call summary (string max 128 characters)", "[Speaker:0] Satisfaction (1-5)", "Keywords (array)" ]

    {"resolved?": "`,
      { chunk: transcript },
      20,
      500,
      1.0,
      'gpt-3'
    ));

  return result;
}
