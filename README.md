# next-server-session
Functions to handle serverside session data and csrf tokens for nextJS 10.x

They can be used both in `getServerSideProps` as well as in API routes.

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

### Example usage in `getServerSideProps()`
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
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse){
    const {user = null} = await getSessionData(req, res);
    if(!user){
        res.status = 403;
        res.end("Forbidden");
        return;        
    }
    res.json(fetchUserData(user));
    res.end();        
}
```
 
<h2 id="setSessionData"><code>setSessionData([polymorph]): Promise<void></code></h2>
This method takes an object and merges it into a existing session object. Only given keys will be overwritten, the rest
of the session object will be preserved. Calling the method will establish a new session, if none exists and write a session
cookie.

### Example usage in `getServerSideProps()`
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

## `replaceSessionData()`
## `pluckSessionData()`
## `destroySession()`
## `getCSRFToken()`
## `validateCSRFToken()`
## `createMemorySessionStore()`
## `createCookieHandler()`
