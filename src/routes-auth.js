var	express		= require('express'),
	passport	= require("passport"),
    async       = require('async'),
    clone       = require('clone'),
    shortid     = require('shortid');

var steam_auth  = require("./steam-strategy.js");

var	config		= require("/shared-code/config.js"),
    database    = require("/shared-code/database.js");

var host = process.env.VIRTUAL_HOST.split(",")[0];

var outside_port;
if (process.env.OUTSIDE_PORT)
    outside_port = process.env.OUTSIDE_PORT;
else
    outside_port = 80;

var steam_realm   = "http://"+host+":"+outside_port+"/";

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Steam profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
    //console.log("serializing", user);
    var serialised = {"id": user.id, "admin": user.admin}
    
    done(null, serialised);
});

var admin_relogs = {};

passport.deserializeUser(
    function(serialised, done)
    {
        var locals = {};
        if(!serialised["id"])
        {
            done(null, null)
            return;
        }
        else
        {
            locals.user_id = serialised["id"];
        }

        //console.log("deserializing", serialised);

        async.waterfall(
            [
                database.generateQueryFunction(
                        "SELECT u.id, u.name, steam_object->>'avatar' as avatar FROM Users u WHERE u.id = $1;",
                        [locals.user_id]),
                function(results, callback)
                {
                    if(results.rowCount <1)
                    {
                        callback("Couldn't find user");
                        return;
                    }

                    locals.user = { "id":   results.rows[0]["id"],
                                    "name": results.rows[0]["name"],
                                    "avatar": results.rows[0]["avatar"],
                                    "admin": null,
                                    "statuses": []
                                };
                    database.query(
                        "SELECT json_agg(ust.label) as statuses FROM UserStatuses us, UserStatusTypes ust WHERE us.user_id=$1 AND us.statustype_id=ust.id;",
                        [locals.user_id],
                        callback);
                },
                function(results, callback)
                {
                    if(results.rowCount > 0 && results.rows[0].statuses)
                    {
                        locals.user.statuses = results.rows[0].statuses;
                        for(var i = 0; i < locals.user.statuses.length; ++i)
                        {
                            if(locals.user.statuses[i] === "admin")
                                locals.user["admin"] = locals.user["id"];
                        }
                    }
                    if(serialised["admin"] && locals.user["admin"] != serialised["admin"])
                    {
                        locals.user["admin"] = serialised["admin"];
                        locals.user["name"] += "(A:"+serialised["admin"]+")";
                    }
                    callback(null);
                }
            ],
            function(err, result)
            {
                if (err)
                {
                    console.log(err);
                    done(null, null)
                }
			    else
                    done(err, locals.user);
            }
        );
    }
);


// Use the SteamStrategy within Passport.
//   Strategies in passport require a `validate` function, which accept
//   credentials (in this case, an OpenID identifier and profile), and invoke a
//   callback with a user object.

passport.use(
	new steam_auth.Strategy(
		{
			returnURL: steam_realm+"auth/steam/return",
			realm: steam_realm,
			apiKey: config.steam_api_key
		},
		function(identifier, done) {
			console.log("Steam verify");
            var steam_id = identifier.substring(identifier.lastIndexOf("/")+1);
            console.log("id "+steam_id);

            var locals = {};
            locals["old"] = false;
            async.waterfall(
                [
                    database.generateQueryFunction(
                        "SELECT id, name FROM Users WHERE steam_identifier = $1;",[steam_id]),
                    function(results, callback)
                    {
                        if(results.rowCount == 0)
                        {
    						console.log("accepting new user");

/*
                         user.name = profile["displayName"];
                                user.identifier = profile["id"];
                                user.steam_object = profile["_json"];
                                user.email = "unknown";
*/
                            steam_auth.getProfile(steam_id, function(err, profile)
                            {
                                if(err)
                                    callback(err);
                                else
                                    database.query("INSERT INTO Users(name, steam_identifier, steam_object, email) VALUES ($1, $2, $3, $4) RETURNING id, name;",[profile["displayName"], profile["id"], profile["_json"], "unknown"],callback);
                            });
                            
                        }
                        else
                        {
    						console.log("accepting old user");  
                            locals.user = results.rows[0];
                            locals["old"] = true;
                            callback(null, locals.user);
                        }
                    },
                    function(results, callback)
                    {
                        if(!locals["old"])
                        {
                            if(results.rowCount != 1)
                            {
                                console.log("weird user create write", results);
                                callback("bad db result");
                                return;
                            }
                            console.log("inserted, got ", results);
                            locals.user = results.rows[0];
                        }

                        var data = {
                            "user": locals["user"]["id"]
                        }

                        database.query("INSERT INTO events(event_type, time, data) VALUES ((SELECT id FROM EventTypes WHERE label=$1),now(), $2);",["LogIn", data],callback);
                    },
                    function(results, callback)
                    {
                        if(results.rowCount != 1)
                        {
                            console.log("weird login event write", results);
                            callback("bad db result");
                        }
                        else
                        {
                            callback();
                        }
                    }
                ],
                function(err, result)
                {

                    if (!(err === "found_old") && err)
                    {
                         console.log(err, result);
                        done(err);
                    }
                    else
                        done(null, locals["user"]); 
                }
            );
    	}
	)
);

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();

// GET /auth/steam
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Steam authentication will involve redirecting
//   the user to steam.com.  After authenticating, Steam will redirect the
//   user back to this application at /auth/steam/return
router.route("/steam")
	.get(	passport.authenticate("steam", { failureRedirect: "/" }),
		  function(req, res) {
    			console.log("should not get called");
		  });

// GET /auth/steam/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
router.route("/steam/return")
    .get(	
        passport.authenticate("steam", { failureRedirect: "/" }),
		function(req, res) {
            //console.log(req.user);
		    console.log("returned from steam");
            console.log(req.originalUrl);
		    res.redirect('/user');
        }
	);

router.route("/logout")
    .get(   
        function(req, res) {
            console.log("logging out");
            req.logout();
            res.redirect('/');
        }
    );

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
    //console.log("ensure");
    if (req.isAuthenticated())
    {
        //console.log("Auth ok");
        return next();
    }
    else
    {
        console.log("go auth u fool");
        res.redirect('/auth/steam');
    }
}


//mirrored from routes-website, maybe pull out
function collectTemplatingData(req)
{
    var data = {};
    data["user"] = req.user;

    return data;
}

//restrict access to admin accounts
function ensureAdmin(req, res, next)
{
    var id = req.user["id"];
    if(req.user["admin"])
        id = req.user["admin"];
    async.waterfall(
        [
            database.generateQueryFunction(
                    "SELECT us.user_id FROM UserStatuses us, UserStatusTypes ust WHERE us.user_id=$1 AND us.statustype_id=ust.id And ust.label=$2",
                    [id, "admin"]),
            function(results, callback)
            {
                //allow access if admin entry found 
                callback(null, results.rowCount > 0);
            }
        ],
        function(err, result)
        {
            if(result)
            {
                next();
            }
            else
            {
                var data = collectTemplatingData(req);
                res.render("pages/no-permission.ejs", data);
            }
        }
    );
};

exports.router = router;
exports.ensureAuthenticated = ensureAuthenticated;
exports.ensureAdmin = ensureAdmin;

