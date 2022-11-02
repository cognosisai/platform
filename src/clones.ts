/**
 * Clones.
 * 
 * This is where it all really begins. A clone is basically an NPC. It has a certain class and configuration. A personality. 
 * And information that persists across a session, or perhaps even sessions, if it is part of a larger workflow.
 */


export interface ChatMessage
{
    timestamp: Date;
    uuid: string;
    text: string;
    response: string;
    context: string;
    user: string;
    calledByUuid?: string;
}

export interface ChatSession
{
    personality: Personality;
    user: string;
    uuid: string;
    messages: ChatMessage[];
}

export interface Personality
{
    name: string;
    personality: string;
    instructions: string[];
}
