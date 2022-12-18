import * as activities from '../../activities';

/* 
 * Import babel so we can parse typescript or javascript files
 */
import * as babel from '@babel/core';
import * as fs from 'fs';

export async function parse( code: string, filename: string ): Promise< babel.ParseResult | null >{
    let lines = code.split( /[\r\n]+/ );

    let result = await babel.parseAsync( code, {
        filename: filename,
        presets: [ '@babel/preset-typescript' ],
        plugins: [ '@babel/plugin-proposal-class-properties' ]
    } );

    if ( result == null )
    {
        console.log(`Failed to parse ${filename}`);
        return result;
    }
    return result;

    result?.program.body.forEach( async (node) => {
        console.log( `${node.type}` );
        //console.log( node );

        if ( node.type === 'FunctionDeclaration' )
        {
            console.log( `${JSON.stringify(node.leadingComments)}` );
            console.log( `${node.id?.name}` );
            node.loc?.start.line;
            node.loc?.end.line;
            console.log( lines.slice( node.loc!.start.line - 1, node.loc?.end.line ).join( '\n' ) );

            console.log( node );
        }
    });
}

export type CodeFragmentType = 'unknown' | 'function';

export interface CodeFragment
{
    type: CodeFragmentType;
    start: {line: number; column: number};
    end:  {line: number; column: number};
    code: string;
    leadingComment: string;
}

export async function nodeToCodeFragment( node: babel.Node, lines: Array< string > ): Promise< CodeFragment >
{
    let start = node.loc?.start;
    let end = node.loc?.end;

    if ( start == null || end == null )
    {
        throw new Error( 'PERMANENT - Node has no location' );
    }

    let leadingComment = '';
    if ( node.leadingComments != null )
    {
        let leadingCommentLines = node.leadingComments.map( (c) => c.value );
        leadingComment = leadingCommentLines.join( '\n' );
    }

    let code = lines.slice( start.line - 1, end.line ).join( '\n' );
    let retval: CodeFragment = {
        type: 'unknown',
        start: {line: start.line, column: start.column},
        end: {line: end.line, column: end.column},
        code: code,
        leadingComment: leadingComment,
    };
    return retval;
}

export interface FunctionCodeFragment extends CodeFragment {
    type: 'function';
    name: string;
    params: Array< string >;
    returnType: string;
    signature: string;
}

export async function extractFunctions( code: string, filename: string ): Promise< Array< FunctionCodeFragment > > {
    let result = await parse( code, filename );
    let functions: Array< FunctionCodeFragment > = [];


    function nodeToFunctionCodeFragment( node: babel.Node ): FunctionCodeFragment
    {
        if ( node.type == 'FunctionDeclaration' )
        {

            let fcf = 
            {
                type: 'function',
                name: node.id?.name ?? '',
                params: new Array< string >(),
                returnType: '',
                start: {line: 0, column: 0},
                end: {line: 0, column: 0},
                code: '',
                leadingComment: node.leadingComments?.map( (c) => c.value ).join( '\n' ) ?? '',
            };

            for ( let param of node.params )
            {
                param = <babel.types.Identifier> param;
                let name_s = param.name
                let i1 = (<any> (param.loc!.end)).index;
                let i2 = (<any> (param.loc!.start)).index;
                let type_s = code.substring( i2, i1 );
                fcf.params.push( type_s );
            }

            let returnType = node.returnType!;
            let i1 = (<any> (returnType.loc!.end)).index;
            let i2 = (<any> (returnType.loc!.start)).index;
            fcf.returnType = code.substring( i2, i1 );


            let start = (<any> node.loc).start;
            let end = (<any> node.loc).end;
            fcf.code = code.substring( start!.index, end!.index );
            let fcf2: FunctionCodeFragment = {
                type: 'function',
                name: fcf.name,
                params: fcf.params,
                returnType: fcf.returnType,
                start: {line: start!.line, column: start!.column},
                end: {line: end!.line, column: end!.column},
                code: fcf.code,
                leadingComment: fcf.leadingComment,
                signature: `${node.async ? "async" : ""} function ${fcf.name}(${fcf.params.join( ', ' )}): ${fcf.returnType.replace( /^\s*:\s*/, '') }`,
            };
            return fcf2;
        }
        else
        {
            console.log( `Unexpected node type ${node.type}` );
            throw new Error( 'PERMANENT - Unexpected node type' );
        }
    }

    result?.program.body.forEach( async (node) => {
        console.log( `${node.type} ${node.range}` )
        if ( node.type === 'FunctionDeclaration' )
        {
            functions.push( await nodeToFunctionCodeFragment( node ) );
        }
        if ( node.type == 'ExportNamedDeclaration' && node.declaration?.type == 'FunctionDeclaration' )
        {
            let decl = await nodeToCodeFragment( node.declaration, code.split( /[\r\n]/ ) );
            decl.leadingComment = node.leadingComments?.map( (c) => c.value ).join( '\n' ) ?? '';
            functions.push( nodeToFunctionCodeFragment( node.declaration ) );
        }
    });

    return functions;
}
