import * as wf from '@temporalio/workflow';
import * as pf from './prompt';
import { defineSignal, setHandler, getExternalWorkflowHandle, defineQuery, workflowInfo} from '@temporalio/workflow';

export const getOutputBuffer = defineQuery<string>('getOutputBuffer');

interface UserInput {
    text: string;
}
interface UserOutput {
    text: string;
}

export const userInputSignal = defineSignal<[UserInput]>('input');
export const userOutputSignal = defineSignal<[UserOutput]>('output');
export const userOutputListenerSignal = defineSignal<[{listener_wf: string, target_wf: string}]>('output_listener');

export interface Frame
{
    text: string;
    ts: Date;
    logs: [Date, string] [];
}


type SessionState = 'IDLE' | 'READ_WAIT' | 'MESSAGE_RECEIVED';

class Session< TFrame extends Frame >
{
    private _messages: TFrame[] = [];
    private _state : SessionState;
    private _inputBuffer: string = '';
    private _outputBuffer: string = '';
    private _outputListeners: string[] = [];

    constructor()
    {
        this._state = 'IDLE';
    }

    public addMessage(message: TFrame): void
    {
        this._messages.push(message);
    }

    public get messages(): TFrame[]
    {
        return this._messages;
    }

    public log( m: string ): void
    {
        console.log( m );
        // Add to last message, if it exists
        if ( this._messages.length > 0 )
        {
            this._messages[this._messages.length-1].logs.push( [new Date(), m] );
        }
        else
        {
            throw new Error("No messages to log to - this should not be possible");
        }
    }

    public logs(): [Date, string] []
    {
        let logs: [Date, string] [] = [];
        for ( let m of this._messages )
        {
            logs = logs.concat(m.logs);
        }
        return logs;
    }

    public get state(): SessionState
    {
        return this._state;
    }

    public set state( s: SessionState )
    {
        this._state = s;
    }

    public get inputBuffer(): string
    {
        let b = this._inputBuffer;
        this._inputBuffer = '';
        return b;
    }

    public get outputBuffer(): string
    {
        let b = this._outputBuffer;
        this._outputBuffer = '';
        return b;
    }

    public recv( s: string ): void
    {
        this._inputBuffer += s;
    }

    public send( s: string ): void
    {
        this._outputBuffer += s;

        this._outputListeners.forEach( (l) => {
            let h = getExternalWorkflowHandle(l);
            h.signal('output', {text: s});
        });
    }

    public addOutputListener( listener: string ): void
    {
        this._outputListeners.push( listener );
    }

    public async init(): Promise< void >
    {
        setHandler(userInputSignal, ({ text }: UserInput) => {
            console.log(`Received input: ${text}`);
            this.recv( text );
            this.state = 'MESSAGE_RECEIVED';
        });

        setHandler(userOutputListenerSignal, async ({listener_wf, target_wf}) => {
            console.log(`Received output monitoring signal for ${target_wf} from ${listener_wf}`);
            this.addOutputListener( listener_wf );
        });

        setHandler(getOutputBuffer, () => {return this.outputBuffer;});
    }
}

async function getInput( mh: Session<any> ): Promise<string>
{

    // Wait for the user to respond
    await wf.condition( () => mh.state == 'MESSAGE_RECEIVED' );
    {
        mh.state = 'IDLE';
        let input = mh.inputBuffer
        return input;
    }
}

export async function send( wfid: string, message: Frame ): Promise<void>
{
    const handle = getExternalWorkflowHandle(wfid);
    await handle.signal( 'input', message );
}

export async function read( wfid: string ): Promise< string >
{
    let waiting = true;
    let rtext = '';
    setHandler( userOutputSignal, ( {text} ) => {
        console.log( `read: ${text}` );
        waiting = false;
        rtext = text;
    });

    let me = workflowInfo().workflowId;
    const handle = getExternalWorkflowHandle(wfid);
    await handle.signal( 'output_listener', {listener_wf: me, target_wf: wfid} );
    await wf.condition( () => !waiting );
    return rtext;
}

export async function sendread( wfid: string, message: Frame ): Promise< string >
{
    let waiting = true;
    let rtext = '';
    setHandler( userOutputSignal, ( {text} ) => {
        console.log( `read: ${text}` );
        waiting = false;
        rtext = text;
    });

    let me = workflowInfo().workflowId;
    const handle = getExternalWorkflowHandle(wfid);
    await handle.signal( 'output_listener', {listener_wf: me, target_wf: wfid} );
    await send( wfid, message );
    await wf.condition( () => !waiting );
    return rtext;
}

export async function testSession( first_message: Frame )
{
    let session = new Session< Frame >();
    session.init();

    // Start the session
    session.addMessage( {... first_message} );
    session.log( "Session started" );
    while( true )
    {
        let input = await getInput( session );
        session.log( "User input: " + input );
        let response = await pf.promptTemplate(
`User: {{{input}}}
Response:`, { input: input } );
        session.log( "Response: " + response );
        session.send( response );
    }
}
