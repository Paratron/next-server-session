# next-server-session
Functions to handle serverside session data and csrf tokens for nextJS 10.x

They can be used both in `getServerSideProps` as well as in API routes.

------------------------------------
## Outline
- [Motivation](#motivation)
- [Configuration](#configuration)
- [Usage](#usage)

## Motivation
I wanted to build a project that uses serverside sessions to store auth data. I disliked the APIs of existing packages,
so I wrote my own.

## Configuration
In order to be able to use the session mechanism, it needs to be initialized once on server startup. The most basic
example is this:

```javascript
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER } = require("next/constants");

module.exports = (phase, { defaultConfig }) => {
    if(phase === PHASE_PRODUCTION_SERVER || phase === PHASE_DEVELOPMENT_SERVER){
        require("next-server-session").configure();
    }

    return defaultConfig;
}
```

By calling `configure()` without providing any probs, you default to a in-memory session management with a default session
lifetime of 30 minutes. If you want to modify the session lifetime, pass a session duration as `sessionMaxAgeMS`.

You should monitor your servers RAM consumption carefully when using this. If you notice a high load, you can swith to an
external session storage like redis, memcached, a mySQL database or just the harddrive. 

If you want to host your application on multiple servers behind a load balancer, you need to have a central external session store as well.

> I will add docs about how to connect to external session storage when I need it, or if someone demands information.

## Usage

### Inside `getServerSideProps` for page routes

```javascript
import {getSessionData, getCSRFToken} from "next-server-session";

// ...

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
    const {user} = await getSessionData(context);

    return {
        props: {
            user,
            csrfToken: await getCSRFToken(context)
        }
    }
};
```
Calling `getSessionData` always returns an object. If no session exists, a new session will be created and an empty object will be returned.

The `getCSRFToken` function returns a random string you can send along with form data or ajax requests to prevent cross site request forgery.
The token will be remembered in the session and a call to `useCSRFToken` will validate if its indeed the currently valid token.

### Inside API routes

```javascript
import { NextApiRequest, NextApiResponse } from "next"
import {setSessionData} from "next-server-session";

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const user = tryToLogin(req);
    if(user){
        await mergeSessionData(req, res, {user: "peter"});
        res.redirect("/dashboard");    
    }
    res.redirect("/login");
}
```

The usage is nearly the same. Instead of the `context` object from `getServerSideProps`, you need to pass the two `req` and `res` objects to all session functions.
The rest of the interaction remains the same.
