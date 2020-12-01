# next-server-session
Functions to handle serverside session data and csrf tokens for nextJS 10.x

They can be used both in `getServerSideProps` as well as in API routes.

> __Heads up!__    
> This module provides a simple and effective mechanism to protect your application against [cross site request forgery](https://owasp.org/www-community/attacks/csrf) attacks.

------------------------------------
## API
- [configure()](#configure)
- [getSessionData()](#getSessionData)
- [setSessionData()](#setSessionData)
- [replaceSessionData()](#replaceSessionData)
- [pluckSessionProperty()](#pluckSessionProperty)
- [destroySession()](#destroySession)
- [getCSRFToken()](#getCSRFToken)
- [validateCSRFToken()](#validateCSRFToken)

## Additional API
- [createMemorySessionStore()](#createMemorySessionStore)
- [createCookieHandler()](#createCookieHandler)

## `configure()`
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


<h2 id="getSessionData"><code>getSessionData([polymorph]): Promise<{}></code></h2>
This method returns the current session object. If no session has been established so far, an empty object will be returned.
Calling this method will _not_ establish a session and will _not_ set a cookie for your visitors.

> Typescript tip:    
> You can tell TS about the interface of your returned session object: `getSessionData<T>(...): Promise<T>`

### Example usage in `getServerSideProps()`
Fetching the currently logged in user - if any.
```typescript
export async function getServerSideProps(context: GetServerSidePropsContext){
    const {user = null} = await getSessionData(context);
    return {
        props: {
            user    
        }    
    }
}
```

### Example usage in API routes
Return user data from an API endpoint, when logged in.
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse){
    const {user = null} = await getSessionData(req, res);
    if(!user){
        res.status(403).end("Forbidden");
        return;        
    }
    res.json(fetchUserData(user));
    res.end();        
}
```
 
<h2 id="setSessionData"><code>setSessionData([polymorph]): Promise&lt;void&gt;</code></h2>
This method takes an object and merges it into a existing session object. Only given keys will be overwritten, the rest
of the session object will be preserved. Calling the method will establish a new session, if none exists and write a session
cookie.

### Example usage in `getServerSideProps()`
Log some actions of the user to modify the experience in other places.
```typescript
export async function getServerSideProps(context: GetServerSidePropsContext){
    await setSessionData({viewedPricingPage: true});    

    return {
        props: {
            data: getPricingData()        
        }    
    }
}
```

### Example usage in API routes
Place products in a cart and persist it in the session.
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse){
    const {cart = {}} = await getSessionData(req, res);
    const {article, amount} = req.body;
    if(validateArticle(article)){
        cart[article] = (cart[article] || 0) + parseInt(amount, 10);
        await setSessionData(req, res, {cart});   
    }    
    res.end("ok");      
}
```

<h2 id="replaceSessionData"><code>replaceSessionData([polymorph]): Promise&lt;void&gt;</code></h2>
This method will replace the whole session object with a new one. This will overwrite/remove all existing session data, so 
be careful when using it.

### Example usage in `getServerSideProps()`
Resets a multi-step form and all helper data. Still be careful with this!
```typescript
export async function getServerSideProps(context: GetServerSidePropsContext){
    await replaceSessionData({step: 1});    

    return {
        props: {
        }    
    }
}
```

### Example usage in API routes
A login example where any stale data from previous user sessions is reset.
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse){
    const {username, password} = req.body;
    let result = login(username, password);
    if(result.user){
        await replaceSessionData({user: result.user});
        res.end("ok");
        return;
    }
    res.end(result.error);
}
```

<h2 id="pluckSessionProperty"><code>pluckSessionProperty([polymorph]): Promise&lt;any | null&gt;</code></h2>
Removes a property from the session object and returns it. Will return `null`, if the property does not exist.

> Typescript tip:    
> You can tell TS about the type of the returned value: `pluckSessionProperty<T>(...): Promise<T | null>`

### Example usage in `getServerSideProps()`
An API handler might store any errors in the session and redirect back to the form. The errors are plucked from the session
and displayed in the form once.
```typescript
export async function getServerSideProps(context: GetServerSidePropsContext){
    const formErrors = await pluckSessionProperty(context, "formErrors");

    return {
        props: {
            formErrors        
        }    
    }
}
```

### Example usage in API routes
A user came from a referral link to a shop. The referral ID is applied ONCE to a purchase, then removed from the session.
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse){
      const referrer = pluckSessionProperty(req, res, "refId");
      res.end(processPurchase(referrer));
}
```

<h2 id="destroySession"><code>destroySession([polymorph]): Promise&lt;void&gt;</code></h2>
This will drop the session data from the session store and mark the cookie to be expired and removed by the browser.

### Example usage in `getServerSideProps()`
This will logout the current user, if a valid CSRF token has been passed. Will render the page, if the logout failed.
```typescript
export async function getServerSideProps(context: GetServerSidePropsContext){
    if(await validateCSRFToken(context.params.csrf)){
        await destroySession();
        return {
            redirect: {
                to: "/"
            }    
        }        
    }

    return {
        props: {    
        }    
    }
}
```

### Example usage in API routes
Same logout example, but with a pure API route.
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse){
    const {csrf} = req.body;
    if(await validateCSRFToken(csrf)){
        destroySession();
        res.redirect("/");
        return;
    }
    res.redirect("/");      
}
```

<h2 id="getCSRFToken"><code>getCSRFToken([polymorph]): Promise&lt;string&gt;</code></h2>
This method generates a random string, stores it in the session and returns it. Use the CSRF token to prevent [cross site
request forgery](https://owasp.org/www-community/attacks/csrf).

### Example usage in `getServerSideProps()`
This generates a CSRF token that can be passed with any forms or requests to the API.
```typescript
export async function getServerSideProps(context: GetServerSidePropsContext){
    return {
        props: {    
            csrfToken: await getCSRFToken(context)
        }    
    }
}
```

### Example usage in API routes
A single page application might automatically receive new tokens from each API call to sign the
next request.
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse){
    const {action, csrfToken} = req.body;
    if(await validateCSRFToken(csrfToken)){
        res.json({
            result: performAction(action),
            nextToken: await getCSRFToken(req, res)
        });
        res.end();
        return;
    }
    res.status(400).end("Bad request"); 
}
```

<h2 id="validateCSRFToken"><code>validateCSRFToken([polymorph]): Promise&lt;boolean&gt;</code></h2>
This method validates a given csrf token against a previously generated random token already stored in the session.
This is used to prevent [cross site request forgery](https://owasp.org/www-community/attacks/csrf) attacks. Use this to protect any requests that perform
actions in behalf of a user.

### Example usage in `getServerSideProps()`
Any page or request that performs an action for a user needs to be protected by a CSRF token.
```typescript
export async function getServerSideProps(context: GetServerSidePropsContext){
    if(await validateCSRFToken(context, context.param.csrf)){
        const {user = null} = getSessionData(context);
        performSomeAction(user);    
    }
        
    return {
        props: {    
        }    
    }
}
```

### Example usage in API routes
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse){
    if(await validateCSRFToken(req, res, req.body.csrfToken)){
        performSomeAction();
        res.end("ok");    
    }
    res.status(400).end("Bad request");   
}
```

-----------------------

The following methods are internal factory functions for the default store and cookie handler.

## `createMemorySessionStore(maxSessionAgeMS: number): SessionStore`
Returns a new session store for in-memory storage of session objects. By default, it will keep
session objects for 30 minutes after they have been interacted with the last time (by getting or setting).

In case you want to modify the default max session age, you need to call this method and pass the result
to the [`configure()`](#configure) method:

```javascript
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER } = require("next/constants");

module.exports = (phase, { defaultConfig }) => {
    if(phase === PHASE_PRODUCTION_SERVER || phase === PHASE_DEVELOPMENT_SERVER){
        require("next-server-session").configure({
            sessionStore: createMemorySessionStore(10 * 60 * 1000) // 10 Minutes
        });
    }

    return defaultConfig;
}
```

I recomment that you implement your own session store when you want to keep your session data any place
else than in the memory of your current machine.

To create a compatible session store, you need to implement its TS interface:

```typescript
interface SessionStore {
    id: () => Promise<string>;
    get: (sessionId: string) => Promise<any | null>;
    set: (sessionId: string, data: any) => Promise<void>;
    merge: (sessionId: string, data: any) => Promise<void>;
    destroy: (sessionId: string) => Promise<any>
}
```

When implementing your own session store, you can resort to [the tests I wrote](https://github.com/Paratron/next-server-session/blob/master/src/index.test.ts#L51) for the memory
session store. 

## `createCookieHandler(cookieName: string = "nextSession", cookieConfig: any)`
This factory function creates a new cookie handler based on the [cookie]() package.

If you want to change the used cookie name or update any configuration, call the method and pass the
result to the [`configure()`]() method.

The default cookie config is:

```json
{
    "httpOnly": true,
    "sameSite": true,
    "path": "/",
    "secure": false
}
```

You can pass any options, the `cookie` module can understand.

```javascript
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER } = require("next/constants");

module.exports = (phase, { defaultConfig }) => {
    if(phase === PHASE_PRODUCTION_SERVER || phase === PHASE_DEVELOPMENT_SERVER){
        require("next-server-session").configure({
            cookieHandler: createCookieHandler("sId", {
              "httpOnly": true,
              "sameSite": true,
              "path": "/basedir",
              "secure": true
          })
        });
    }

    return defaultConfig;
}
```
