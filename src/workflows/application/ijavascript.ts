import * as ijavascript from "../../activities/application/ijavascript";
import { proxyActivities, uuid4 } from '@temporalio/workflow';

const { executeJavascriptNotebook } = proxyActivities< typeof ijavascript >({ startToCloseTimeout: '10 minute',  });
import {OPENAI_TOKEN} from '../../config';

export async function IJavascript( query: string ): Promise< string >
{
    let result = executeJavascriptNotebook( query, OPENAI_TOKEN );
    return( result );
}
