import { ChatSession } from "../clones";

/* Example:
        "text": "nilp, do an nmap on 38.101.40.11 | !kali_sh:{\"command\": \"nmap 38.101.40.11\"}",
        "user": "U03UF3XNM8D",
        "prompt": "nilp, do an nmap on 38.101.40.11",
        "completion": "!kali_sh:{\"command\": \"nmap 38.101.40.11\"}\n2e72b3",
        "prompt_leading": "!kali_sh:{\"command\": \"nmap 38.101.40.11\"}"

        */
export interface Teaching
{
    text: string;
    user?: string;
    prompt: string;
    completion: string;
    prompt_leading: string;
}

export type CogHandler = ( session: ChatSession, args: any, message_sans_args: string ) => Promise< string >;


export class Cog
{
    protected _id: string;
    protected teachings: Teaching[];
    protected coghandler: CogHandler;

    public constructor( id: string, teachings: Teaching[], coghandler: CogHandler )
    {
        this._id = id;
        this.teachings = teachings;
        this.coghandler = coghandler;
    }

    public getTeachings(): Teaching[]
    {
        return this.teachings;
    }

    get id(): string
    {
        return this._id;
    }

    public async handle( session: ChatSession, args: any, message_sans_args: string ): Promise< string >
    {
        return await this.coghandler( session, args, message_sans_args );
    }
}


export class Cogset
{
    protected cogs: Cog[];
    protected cogmap: Map< string, Cog >;

    public constructor( cogs: Cog[] )
    {
        this.cogs = cogs;
        this.cogmap = new Map< string, Cog >();
        for ( let cog of cogs )
        {
            this.cogmap.set( cog.id, cog );
        }
    }

    public getCogs(): Cog[]
    {
        return this.cogs;
    }

    public getCog( id: string ): Cog | undefined
    {
        return this.cogmap.get( id );
    }

    public addCog( cog: Cog ): void
    {
        this.cogs.push( cog );
        this.cogmap.set( cog.id, cog );
    }

    public removeCog( cog: Cog ): void
    {
        this.cogs = this.cogs.filter( ( c ) => c.id !== cog.id );
        this.cogmap.delete( cog.id );
    }
}
