/* Declare global variables*/
DEBUG=false;

//data organisation
pregame_time = 90;

replay_data = {};

function loadData(json_address, callback_finished)
{
d3.json(//"data/monkey_vs_nip.json"
    json_address
        ,function(error, data){
            replay_data = data;
            fixReplayData();
            buildDataIndices();
            callback_finished();
        });
}

function buildDataIndices()
{
    for (var event_id in replay_data["events"]) {
        replay_data["events"][event_id]["id"] = event_id;
    }

    //sort events

    replay_data["indices"] = {};
    replay_data["indices"]["kills"] = [];
    replay_data["indices"]["fights"] = [];
    for (var event_id in replay_data["events"]) {
        switch(replay_data["events"][event_id]["type"])
        {
        case "kill":
            replay_data["indices"]["kills"].push(event_id);
            break;
        case "fight":
            replay_data["indices"]["fights"].push(event_id);
            break;
        }
    }

    /* By Entity*/

    replay_data["indices"]["by-entity"] = {};
    for (var entity_id in replay_data["entities"]) {
        if(replay_data["entities"][entity_id].hasOwnProperty("control"))
        {
            replay_data["indices"]["by-entity"][entity_id] = [];
        }
    }

    for (var event_id in replay_data["events"]) {
        if(!replay_data["events"][event_id].hasOwnProperty("involved"))
            continue;
        for (var involved_i in replay_data["events"][event_id]["involved"])
        {
            if(replay_data["indices"]["by-entity"].hasOwnProperty(replay_data["events"][event_id]["involved"][involved_i]))
            {
                replay_data["indices"]["by-entity"][replay_data["events"][event_id]["involved"][involved_i]].push(event_id);
            }
        }
    }

    for (var entity_id in replay_data["indices"]["by-entity"]) {
        replay_data["indices"]["by-entity"][entity_id].sort(compareEventKeysByTime);
    }

    /* By location line*/

    replay_data["indices"]["by-location-line"] = {};
    for (var location_line_i in gui_state["location-lines"]) {
        replay_data["indices"]["by-location-line"][gui_state["location-lines"][location_line_i]["layout-nr"]] = [];
    }

    for (var event_id in replay_data["events"]) {
        if(!replay_data["events"][event_id].hasOwnProperty("location"))
            continue;
        replay_data["indices"]["by-location-line"][getLocationLine(replay_data["events"][event_id]["location"])].push(event_id);
    }

    for (var location_line_i in replay_data["indices"]["by-location-line"]) {
        replay_data["indices"]["by-location-line"][location_line_i].sort(compareEventKeysByTime);
    }

    //Merge events for diagram
    replay_data["diagram-events"] = []
    for (var location_line_i in replay_data["indices"]["by-location-line"]) {
        replay_data["diagram-events"] = replay_data["diagram-events"].concat(generateDiagramEvents(replay_data["indices"]["by-location-line"][location_line_i]))
    }

    var a=0;
}

function fixReplayData()
{
    //fix some shit from the python, hopefully obsolete in next analysis version

    for (var event_id in replay_data["events"])
    {
        switch(replay_data["events"][event_id]["type"])
        {
        case "kill":
            break;
        case "fight":
            replay_data["events"][event_id]["position"] = replay_data["events"][event_id]["mean_position"];
            break;
        }
    }
}

function generateDiagramEvents(events)
{
    var event_data = [];
    for (var event_i in events) {
        event_data.push(replay_data["events"][events[event_i]]);
    }
    var intersecting_groups = partitionIntoIntersectingGroups(event_data);
    var result = [];

    for (var group_i in intersecting_groups) {
        result = result.concat(processEventGroup(intersecting_groups[group_i]));
    }

    return result;
}

function partitionIntoIntersectingGroups(events)
{
    var result = [];

    events.sort(compareEventsByTime);

    var intersecting_group = [];
    var end_of_group = -pregame_time;//init so it doesnt block at beginning
    for (var event_i in events) {
        var event = events[event_i];
        var group_finished = false;
        var event_start = 0;
        var event_end = 0;
        if(event.hasOwnProperty("time"))
        {
            event_start = event["time"];
            event_end = event["time"];
        }
        else if(event.hasOwnProperty("time_start"))
        {
            event_start = event["time_start"];
            event_end = event["time_end"];
        }
        else{
            console.log("bad event");
            continue;
        }

        if(event_start > end_of_group)
            group_finished = true;

        if(group_finished)
        {
            if(intersecting_group.length > 0)
                result.push(intersecting_group);
            intersecting_group = [];
        }
        intersecting_group.push(events[event_i]);
        end_of_group = Math.max(end_of_group, event_end);
    }
    if(intersecting_group.length > 0)
        result.push(intersecting_group);
    return result;
}

function processEventGroup(intersecting_group)
{
    var grouped = {};
    var n_groupings = 0;
    for(var intersecting_i in intersecting_group)
    {
        var event = intersecting_group[intersecting_i];
        var identifier = event["type"];//+"--"+event["location"];
        if(event["type"]=="fight")
            identifier += event["time_start"];

        if(grouped.hasOwnProperty(identifier))
        {
            grouped[identifier].push(intersecting_group[intersecting_i]);
        }
        else
        {
            grouped[identifier] = [intersecting_group[intersecting_i]];
            n_groupings++;
        }
    }
    merged_events = []
    for(var identifier in grouped)
    {
        var involved = {};
        var time_start  = replay_data["header"]["length"];
        var time_end  = -pregame_time;
        for(var merged_i in grouped[identifier])
        {
            var event = grouped[identifier][merged_i];
            for(involved_i in event["involved"])                
                involved[event["involved"][involved_i]] = 1;
            if(event.hasOwnProperty("time"))
            {
                time_start = Math.min(time_start, event["time"]);
                time_end = Math.max(time_end, event["time"]);
            }
            else if(event.hasOwnProperty("time_start"))
            {
                time_start = Math.min(time_start, event["time_start"]);
                time_end = Math.max(time_end, event["time_end"]);
            }
            else
            {
                console.log("bad event");
            }
        }
        var generated_id =identifier+time_start+"-"+time_end;
        var event_ids = [];
        for(var merged_i in grouped[identifier])
        {
            var event = grouped[identifier][merged_i];
            replay_data["events"][event["id"]]["display-id"] = generated_id;
            event_ids.push(event["id"]);
        }
        var diagram_event = 
        {
            "id": generated_id,
            "time_start": time_start,
            "time_end": time_end,
            "involved":Object.keys(involved),
            "location": grouped[identifier][0]["location"],
            "type": grouped[identifier][0]["type"],
            "events":event_ids
        };          

        merged_events.push(diagram_event);
    }
    

    var partitioned = partitionIntoIntersectingGroups(merged_events);

    var result = [];
    for(var group_i in partitioned)
    {
        for(var event_i in partitioned[group_i])
        {
            var final_event = partitioned[group_i][event_i];
            final_event["group-size"] = partitioned[group_i].length,
            final_event["group-i"] = parseInt(event_i),

            result.push(final_event);
        }
    }

    return result;
}

function compareEventsByTime(a, b)
{
    var time_a = 0;
    var time_b = 0;
    if(a.hasOwnProperty("time"))
        time_a = a["time"];
    else if(a.hasOwnProperty("time_start"))
        time_a = a["time_start"];

    if(b.hasOwnProperty("time"))
        time_b = b["time"];
    else if(b.hasOwnProperty("time_start"))
        time_b = b["time_start"];

    if(time_a < time_b)
        return -1;
    else if(time_a > time_b)
        return 1;
    else
        return 0;
}

function compareEventKeysByTime(a, b)
{
    return compareEventsByTime(replay_data["events"][a], replay_data["events"][b]);
}

function getTimeseriesValue(timeseries, current_time)
{
    switch(timeseries["format"])
    {
    case "samples":
        var index_below = -1;
        var max_time_below = 0;
        var index_above = -1;
        var min_time_above = 0;
        var vaue = 0;
        for(i in timeseries["samples"])
        {
            if(timeseries["samples"][i]["t"] <= current_time)
            {
                if(index_below < 0)
                {
                    index_below = i;
                    max_time_below = timeseries["samples"][i]["t"];
                }
                else if(timeseries["samples"][i]["t"] > max_time_below)
                {
                    index_below = i;
                    max_time_below = timeseries["samples"][i]["t"];
                }
            }
            else
            {
                if(index_above < 0)
                {
                    index_above = i;
                    min_time_above = timeseries["samples"][i]["t"];
                }
                else if(timeseries["samples"][i]["t"] < max_time_below)
                {
                    index_above = i;
                    min_time_above = timeseries["samples"][i]["t"];
                }
            }
        }

        if(index_below < 0 && index_above < 0)
        {
            console.log("Bad timeseries without samples.");
            return [];
        }
        else if(index_below < 0 && index_above >= 0)
        {
            return timeseries["samples"][index_above]["v"];
        }
        else if(index_below >= 0 && index_above < 0)
        {
            return timeseries["samples"][index_below]["v"];
        }
        else{
            var blend = (current_time - max_time_below) / (min_time_above - max_time_below);
            var interpolated = timeseries["samples"][index_below]["v"].slice();
            for(var i in timeseries["samples"][index_above]["v"])
            {
                interpolated[i] += blend* (timeseries["samples"][index_above]["v"][i] - timeseries["samples"][index_below]["v"][i]);
            }
            return interpolated;
        }
    }
}

function generateGraph(id, group, timeseries, xrange, yrange, area_colors){
    var graph_node = group.append("g")
                .attr("id", id+"-graph");
    switch(timeseries["format"])
    {
    case "samples":
        xscale = d3.scale.linear()
                .domain(xrange)
                .range(xrange);

        var range = Math.max(   Math.abs(d3.min(timeseries["samples"], function(sample){return sample["v"];})),
                    Math.abs(d3.max(timeseries["samples"], function(sample){return sample["v"];}))
                    );
        yscale = d3.scale.linear()
                .domain([-range,range])
                .range(yrange);

        var postive_area = d3.svg.area()
            .x(function(d) {
                var val = 0;
                if("t" in d)
                    val = d["t"];
                else
                    console.log("bad datapoint", d);
                return xscale(val);
            })
            .y0(0)
            .y1(function(d) 
                {
                    var val = 0;

                    if(d["v"] instanceof Array) 
                        val = d["v"][0];
                    else if("v" in d)
                        val = d["v"];
                    else
                        console.log("bad datapoint", d);

                    return - Math.max(0, yscale(val));
                });

        var negative_area = d3.svg.area()
            .x(function(d) {
                var val = 0;
                if("t" in d)
                    val = d["t"];
                else
                    console.log("bad datapoint", d);
                return xscale(val);
            })
            .y0(function(d) 
                {
                    var val = 0;

                    if(d["v"] instanceof Array) 
                        val = d["v"][0];
                    else if("v" in d)
                        val = d["v"];
                    else
                        console.log("bad datapoint", d);
                    return - Math.min(0, yscale(val));
                })
            .y1(0);

        var line = d3.svg.line()
                    .x(function(d) {
                        var val = 0;
                        if("t" in d)
                            val = d["t"];
                        else
                            console.log("bad datapoint", d);
                        return xscale(val);
                        })
                    .y(function(d) 
                        {
                            var val = 0;

                            if(d["v"] instanceof Array) 
                                val = d["v"][0];
                            else if("v" in d)
                                val = d["v"];
                            else
                                console.log("bad datapoint", d);
                            return - yscale(val);
                        })
                    .interpolate('linear');

        graph_node.append('svg:path')
            .attr({ "id": id+"-graph-positive-area",
                "d": postive_area(timeseries["samples"]),
                "stroke-width": 0,
                "fill": area_colors[0],
                "opacity": 0.5});

        graph_node.append('svg:path')
            .attr({ "id": id+"-graph-negative-area",
                "d": negative_area(timeseries["samples"]),
                "stroke-width": 0,
                "fill": area_colors[1],
                "opacity": 0.5});

        graph_node.append('svg:path')
            .attr({ "id": id+"-graph-line",
                "d": line(timeseries["samples"]),
                "stroke": "black",
                "stroke-width": 2,
                "fill": "none"});


        return ;
    }
}

function getTimeseriesSamples(timeseries, filter_func){
    var result = [];
    switch(timeseries["format"])
    {
    case "samples":
        return timeseries["samples"].filter(filter_func);
    default:
        console.log("bad timeseries");
        return [];
    }
}


// set up internal display state
gui_state = {
    "autoscroll-enabled": false,
    "autoscroll-factor": 4,
    "cursor-time": -pregame_time+15,

    "timeline-cursor-width": 30,
    "active-sub-timelines": 0,  
    "timelines": [],

    "location-lines": [],

    "selected-event": null,
    "visible-unit-histories": [],
    "highlighted-unit": null,

    "content-selected": "events"
};

content_types = ["overview"];// ,"events"];, "diagram"];

map_events = ["fight", "movement", "fountain-visit", "jungling", "laning", "creep-death"/*, "rotation"*/];

d3_elements = {}; //Filled by creation methods

colors_reds = ["#FC9494", "#D35858", "#B23232", "#8E1515", "#630000"];
colors_greens = ["#76CA76", "#46A946", "#288E28", "#117211", "#004F00"];
colors_blues = ["#7771AF", "#504893", "#372E7C", "#221A63", "#0F0945"];
colors_yellows = ["#FCE694", "#D3B858", "#B29632", "#8E7415", "#634D00"];
colors_purples = ["#A573B9", "#83479B", "#6D2D86", "#581971", "#400857"];
colors_beiges = ["#F8FD99", "#E1E765", "#C0C73D", "#A1A820", "#7B8106"];

colors_players = ["#015fff", "#01ff8a", "#a801ff", "#fff501", "#ff6a01", "#fb85c1", "#a1b343", "#1ccae4", "#008122", "#ab6800"];


gui_state["location-lines"] =
[
    {
        "label": "Top Lane",
        "layout-nr": 0 
    },
    {
        "label": "Top Half",
        "layout-nr": 1 
    },
    {
        "label": "Radiant Base",
        "layout-nr": 2 
    },
    {
        "label": "Middle Lane",
        "layout-nr": 3 
    },
    {
        "label": "Dire Base",
        "layout-nr": 4 
    },
    {
        "label": "Bottom Half",
        "layout-nr": 5 
    },
    {
        "label": "Bottom Lane",
        "layout-nr": 6 
    }
];

function getLocationLine(location)
{
    if(location_to_locationline.hasOwnProperty(location))
        return location_to_locationline[location];
    else
    {
        console.log("unknown location for locaitonline - "+location);
        return 0;
    }
}

location_to_locationline = 
{

    "radiant-base": 2,
    "dire-base": 4,


    "top-rune": 1,
    "bottom-rune": 5,

    "toplane-dire-t1": 0,//legacy

    "toplane-between-t1s": 0,
    "toplane-between-radiant-t1-t2": 0,
    "toplane-between-radiant-t2-t3": 0,
    "toplane-between-dire-t1-t2": 0,
    "toplane-between-dire-t2-t3": 0,
    "top": 0,

    "dire-jungle": 1,
    "radiant-secret": 1,
    "radiant-ancient": 1,

    "midlane-dire-before-t1": 3,//legacy

    "midlane-between-t1s": 3,
    "midlane-radiant-between-t1-t2": 3,
    "midlane-radiant-between-t2-t3": 3,
    "midlane-dire-between-t1-t2": 3,
    "midlane-dire-between-t2-t3": 3,

    "mid": 3,

    "radiant-jungle": 5,
    "dire-secret": 5,
    "dire-ancient": 5,
    "roshan": 5,

    "botlane-radiant-t1": 6,//legacy
    "botlane-radiant-before-t1": 6,//legacy

    "botlane-between-t1s": 6,
    "botlane-radiant-between-t1-t2": 6,
    "botlane-radiant-between-t2-t3": 6,
    "botlane-dire-between-t1-t2": 6,
    "botlane-dire-between-t2-t3": 6,

    "bot": 6
};


/*
Timeline configuration
*/

timeline_inset_left = 140;
timeline_inset_right = 10;
timeline_height = 200;
timeline_timescale_height = 50;
timeline_height_inset_factor = 0.9;
timeline_separator_width = 5;
timeline_separator_offset_labels = 10;
timeline_kill_radius = 10;

timeline_cursor_snap_interval = 15;

color_scale_fights = d3.scale.linear()
            .domain([1, 3, 8, 10])
            .range([colors_blues[1], colors_blues[2], colors_blues[3], colors_blues[4]]);

function getLocationCoordinates(location)
{
    if(location_coordinates.hasOwnProperty(location))
        return location_coordinates[location].clone();
    else
    {
        console.log("unknown location for locatoncoordinates - "+location);
        return new Victor(0,0);
    }
}

location_coordinates =
{
    "radiant-base": new Victor(10, 87),
    "dire-base": new Victor(90, 13),

    "top-rune": new Victor(36, 38),
    "bottom-rune": new Victor(68, 63),

    "radiant-ancient": new Victor(32, 49),
    "radiant-secret": new Victor(23, 43),

    "dire-ancient": new Victor(74, 55),
    "dire-secret": new Victor(73, 48),
    "roshan": new Victor(74, 62),

    "toplane-dire-t1": new Victor(18, 13),//legacy

    "toplane-between-t1s": new Victor(13, 30),
    "toplane-between-radiant-t1-t2": new Victor(13, 48),
    "toplane-between-radiant-t2-t3": new Victor(13, 65),
    "toplane-between-dire-t1-t2": new Victor(32, 12),
    "toplane-between-dire-t2-t3": new Victor(62, 12),

    "midlane-dire-before-t1": new Victor(51, 49),//legacy

    "midlane-between-t1s": new Victor(48, 52),
    "midlane-radiant-between-t1-t2": new Victor(35, 62),
    "midlane-radiant-between-t2-t3": new Victor(28, 70),
    "midlane-dire-between-t1-t2": new Victor(59, 42),
    "midlane-dire-between-t2-t3": new Victor(74, 32),

    "botlane-radiant-t1": new Victor(83, 87),//legacy
    "botlane-radiant-before-t1": new Victor(87, 81),//legacy

    "botlane-between-t1s": new Victor(88, 73),
    "botlane-radiant-between-t1-t2": new Victor(65, 87),
    "botlane-radiant-between-t2-t3": new Victor(37, 88),
    "botlane-dire-between-t1-t2": new Victor(90, 55),
    "botlane-dire-between-t2-t3": new Victor(90, 40),

    "dire-jungle": new Victor(38, 23),
    "radiant-jungle": new Victor(60, 78)
};

icon_size = 5;

icon_images = {
    "abaddon":              "/static/img/heroes/icons/Abaddon_icon.png",
    "alchemist":            "/static/img/heroes/icons/Alchemist_icon.png",
    "ancient_apparition":   "/static/img/heroes/icons/Ancient_Apparition_icon.png",
    "antimage":             "/static/img/heroes/icons/Antimage_icon.png",
    "arc_warden":           "/static/img/heroes/icons/Arc_Warden_icon.png",
    "axe":                  "/static/img/heroes/icons/Axe_icon.png",
    "bane":                 "/static/img/heroes/icons/Bane_icon.png",
    "batrider":             "/static/img/heroes/icons/Batrider_icon.png",
    "beastmaster":          "/static/img/heroes/icons/Beastmaster_icon.png",
    "bloodseeker":          "/static/img/heroes/icons/Bloodseeker_icon.png",
    "bounty_hunter":        "/static/img/heroes/icons/Bounty Hunter_icon.png",
    "brewmaster":           "/static/img/heroes/icons/Brewmaster_icon.png",
    "bristleback":          "/static/img/heroes/icons/Bristleback_icon.png",
    "broodmother":          "/static/img/heroes/icons/Broodmother_icon.png",
    "centaur":              "/static/img/heroes/icons/Centaur Warrunner_icon.png",
    "chaos_knight":         "/static/img/heroes/icons/Chaos Knight_icon.png",
    "chen":                 "/static/img/heroes/icons/Chen_icon.png",
    "clinkz":               "/static/img/heroes/icons/Clinkz_icon.png",
    "crystal_maiden":       "/static/img/heroes/icons/Crystal Maiden_icon.png",
    "dark_seer":            "/static/img/heroes/icons/Dark Seer_icon.png",
    "dazzle":               "/static/img/heroes/icons/Dazzle_icon.png",
    "death_prophet":        "/static/img/heroes/icons/Death Prophet_icon.png",
    "disruptor":            "/static/img/heroes/icons/Disruptor_icon.png",
    "doom_bringer":         "/static/img/heroes/icons/Doom Bringer_icon.png",
    "dragon_knight":        "/static/img/heroes/icons/Dragon Knight_icon.png",
    "drow_ranger":          "/static/img/heroes/icons/Drow Ranger_icon.png",
    "earthshaker":          "/static/img/heroes/icons/Earthshaker_icon.png",
    "elder_titan":          "/static/img/heroes/icons/Elder Titan_icon.png",
    "earth_spirit":          "/static/img/heroes/icons/Earth Spirit_icon.png",
    "ember_spirit":         "/static/img/heroes/icons/Ember Spirit_icon.png",
    "enchantress":          "/static/img/heroes/icons/Enchantress_icon.png",
    "enigma":               "/static/img/heroes/icons/Enigma_icon.png",
    "furion":               "/static/img/heroes/icons/Nature's Prophet_icon.png",
    "faceless_void":        "/static/img/heroes/icons/Faceless Void_icon.png",
    "gyrocopter":           "/static/img/heroes/icons/Gyrocopter_icon.png", 
    "huskar":               "/static/img/heroes/icons/Huskar_icon.png",
    "invoker":              "/static/img/heroes/icons/Invoker_icon.png",
    "jakiro":               "/static/img/heroes/icons/Jakiro_icon.png",
    "juggernaut":           "/static/img/heroes/icons/Juggernaut_icon.png",
    "keeper_of_the_light":  "/static/img/heroes/icons/Keeper of the Light_icon.png",
    "kunkka":               "/static/img/heroes/icons/Kunkka_icon.png",
    "legion_commander":     "/static/img/heroes/icons/Legion Commander_icon.png",
    "leshrac":              "/static/img/heroes/icons/Leshrac_icon.png",
    "lich":                 "/static/img/heroes/icons/Lich_icon.png",
    "life_stealer":         "/static/img/heroes/icons/Life Stealer_icon.png",
    "lina":                 "/static/img/heroes/icons/Lina_icon.png",
    "lion":                 "/static/img/heroes/icons/Lion_icon.png",
    "lone_druid":           "/static/img/heroes/icons/Lone Druid_icon.png",
    "luna":                 "/static/img/heroes/icons/Luna_icon.png",
    "lycan":                "/static/img/heroes/icons/Lycanthrope_icon.png",
    "magnataur":            "/static/img/heroes/icons/Magnataur_icon.png",
    "medusa":               "/static/img/heroes/icons/Medusa_icon.png",
    "meepo":                "/static/img/heroes/icons/Meepo_icon.png",
    "mirana":               "/static/img/heroes/icons/Mirana_icon.png",
    "morphling":            "/static/img/heroes/icons/Morphling_icon.png",
    "naga_siren":           "/static/img/heroes/icons/Naga Siren_icon.png",
    "necrolyte":            "/static/img/heroes/icons/Necrolyte_icon.png",
    "nevermore":            "/static/img/heroes/icons/Shadow Fiend_icon.png",
    "night_stalker":        "/static/img/heroes/icons/Night Stalker_icon.png",
    "nyx_assassin":         "/static/img/heroes/icons/Nyx Assassin_icon.png",
    "obsidian_destroyer":   "/static/img/heroes/icons/Obsidian Destroyer_icon.png",
    "ogre_magi":            "/static/img/heroes/icons/Ogre Magi_icon.png",
    "omniknight":           "/static/img/heroes/icons/Omniknight_icon.png",
    "oracle":               "/static/img/heroes/icons/Oracle_icon.png",
    "phantom_assassin":     "/static/img/heroes/icons/Phantom Assassin_icon.png",
    "phantom_lancer":       "/static/img/heroes/icons/Phantom Lancer_icon.png",
    "phoenix":              "/static/img/heroes/icons/Phoenix_icon.png",
    "puck":                 "/static/img/heroes/icons/Puck_icon.png",
    "pudge":                "/static/img/heroes/icons/Pudge_icon.png",
    "pugna":                "/static/img/heroes/icons/Pugna_icon.png",
    "queenofpain":          "/static/img/heroes/icons/Queen Of Pain_icon.png",
    "rattletrap":           "/static/img/heroes/icons/Rattletrap_icon.png",
    "razor":                "/static/img/heroes/icons/Razor_icon.png",
    "riki":                 "/static/img/heroes/icons/Riki_icon.png",
    "rubick":               "/static/img/heroes/icons/Rubick_icon.png",
    "sand_king":            "/static/img/heroes/icons/Sand King_icon.png",
    "shadow_demon":         "/static/img/heroes/icons/Shadow Demon_icon.png",
    "shadow_shaman":        "/static/img/heroes/icons/Shadow Shaman_icon.png",
    "shredder":             "/static/img/heroes/icons/Shredder_icon.png",
    "silencer":             "/static/img/heroes/icons/Silencer_icon.png",
    "skeleton_king":        "/static/img/heroes/icons/Wraith_King_icon.png",
    "skywrath_mage":        "/static/img/heroes/icons/Skywrath_Mage_icon.png",
    "slardar":              "/static/img/heroes/icons/Slardar_icon.png",
    "slark":                "/static/img/heroes/icons/Slark_icon.png",
    "sniper":               "/static/img/heroes/icons/Sniper_icon.png",
    "spectre":              "/static/img/heroes/icons/Spectre_icon.png", 
    "spirit_breaker":       "/static/img/heroes/icons/Spirit Breaker_icon.png",
    "storm_spirit":         "/static/img/heroes/icons/Storm_Spirit_icon.png",
    "sven":                 "/static/img/heroes/icons/Sven_icon.png",
    "techies":              "/static/img/heroes/icons/Techies_icon.png",
    "templar_assassin":     "/static/img/heroes/icons/Templar Assassin_icon.png",
    "terrorblade":          "/static/img/heroes/icons/Terrorblade_icon.png",
    "tidehunter":           "/static/img/heroes/icons/Tidehunter_icon.png",
    "tinker":               "/static/img/heroes/icons/Tinker_icon.png",
    "tiny":                 "/static/img/heroes/icons/Tiny_icon.png",
    "treant":               "/static/img/heroes/icons/Treant_icon.png",
    "troll_warlord":        "/static/img/heroes/icons/Troll Warlord_icon.png",
    "tusk":                 "/static/img/heroes/icons/Tusk_icon.png",
    "undying":              "/static/img/heroes/icons/Undying_icon.png",
    "vengefulspirit":       "/static/img/heroes/icons/Vengeful Spirit_icon.png",
    "venomancer":           "/static/img/heroes/icons/Venomancer_icon.png",
    "viper":                "/static/img/heroes/icons/Viper_icon.png", 
    "visage":               "/static/img/heroes/icons/Visage_icon.png",
    "ursa":                 "/static/img/heroes/icons/Ursa_icon.png",
    "warlock":              "/static/img/heroes/icons/Warlock_icon.png",
    "weaver":               "/static/img/heroes/icons/Weaver_icon.png",
    "windrunner":           "/static/img/heroes/icons/Windrunner_icon.png",
    "winter_wyvern":        "/static/img/heroes/icons/Winter_Wyvern_icon.png",
    "wisp":                 "/static/img/heroes/icons/Wisp_icon.png",
    "witch_doctor":         "/static/img/heroes/icons/Witch_Doctor_icon.png",
    "zuus":                 "/static/img/heroes/icons/Zeus_icon.png"
};

event_duration = 5;
event_maximum_opacity = 0.7;

rotation_offset = 5;
rotation_width = 2;

team_color =
{
    "radiant": colors_greens[2],
    "dire": colors_reds[2]
};


/*
Diagram configuration
*/

diagram_inset_left = 100;
diagram_inset_right = 10;
diagram_display_width = 400;
diagram_display_inset = 20;
diagram_height = 300;

diagram_separator_width = 2;

diagram_time_displayed = 240;

diagram_inset_top = 15;
diagram_tick_interval = 60;

diagram_event_height_margins = 0.2;

diagram_icon_size = 20;


/*
    Init functions
Create the D3 elements used for the interface 
*/
/*function initTimeline(){
    loadSVG("img/timeline.svg", "timeline", function(){});
}*/

update_interval = 200; // in milliseconds

function initVisualisation(){
    initTimeline();
    initMap();
    initLegend();
    initContent();

    d3.selectAll("[data-id]")
        .on("click", function(){togglePlayer(this)});

    //start autoupdate
    setTimeout(timedUpdate, update_interval);
}


function timedUpdate()
{
    if(gui_state["autoscroll-enabled"])
    {
        gui_state["cursor-time"] = validateTimeCursor(gui_state["cursor-time"] + (update_interval/1000 * gui_state["autoscroll-factor"]));
    }
    updateVisualisation();

    setTimeout(timedUpdate, update_interval);
}

function updateVisualisation()
{
    updateTimeline();
    updateContent();
    updateMap();
}


function initLegend(){
    //loadSVG("img/legend.svg", "legend", function(){});
}


/*
Timeline 
*/

function initTimeline(){

    var game_length = replay_data["header"]["length"];

    d3_elements["timeline-svg"] = d3.select("#timeline")
                    .append("svg")
                    .attr({ "id": "timeline-svg",
                        "class": "svg-content",
                        "viewBox": "-"+(timeline_inset_left+pregame_time)+" 0 "+(game_length+pregame_time+timeline_inset_left+timeline_inset_right)+" "+timeline_height});
    
    d3_elements["timeline-svg-foreground"] = d3.select("#timeline")
                    .append("svg")
                    .attr({ "id": "timeline-svg-foreground",
                        "class": "svg-content-overlay",
                        "viewBox": "-"+(timeline_inset_left+pregame_time)+" 0 "+(game_length+pregame_time+timeline_inset_left+timeline_inset_right)+" "+timeline_height});

    d3_elements["timeline-svg"].append("svg:rect")
                    .attr({ "id": "timeline-separator",
                        "x": (-pregame_time-timeline_separator_width),
                        "y": 0,
                        "width": timeline_separator_width,
                        "height": timeline_height
                    })

    d3_elements["timeline-drag"] = d3.behavior.drag()  
             .on('dragstart', function() { 
                        gui_state["cursor-time"] = validateTimeCursor(d3.mouse(this)[0]);
                        updateVisualisation();
                        d3_elements["timeline-cursor"].style('fill', 'red'); })
             .on('drag', function() {   
                    gui_state["cursor-time"] = validateTimeCursor(d3.event.x);
                    updateVisualisation();
                })
             .on('dragend', function() { gui_state["cursor-time"] = validateTimeCursor(Math.round(gui_state["cursor-time"]/timeline_cursor_snap_interval) * timeline_cursor_snap_interval);
                    updateVisualisation();
                    d3_elements["timeline-cursor"].style('fill', 'black'); });



    var cursor_y_offset = 0;//timeline_height* (1-timeline_height_inset_factor)/2,
    var cursor_height = timeline_height;//*timeline_height_inset_factor;
    d3_elements["timeline-svg-foreground"]
                .append('svg:rect')
                .attr({
            'id': 'timeline-draggable-area',
            "class": "interactive-area",
            'x': -pregame_time,//overridden by time
                    'y': cursor_y_offset,
                    'width': game_length + pregame_time,
                    'height': cursor_height,
            'opacity': 0
            })
                .call(d3_elements["timeline-drag"]);

    d3_elements["timeline-svg-foreground"]
                .append('svg:rect')
                .attr({
            'id': 'timeline-cursor',
            'x': 0,//overridden by time
                    'y': cursor_y_offset,
                    'width': gui_state["timeline-cursor-width"],
                    'height': cursor_height
            })
                .call(d3_elements["timeline-drag"]);

    d3_elements["timeline-cursor"] = d3_elements["timeline-svg-foreground"].select("#timeline-cursor");

    d3_elements["timeline-timescale"] = d3_elements["timeline-svg"].append("svg:g")
                        .attr({"id": "timeline-timescale",
                            "transform": "translate(0, "+(timeline_height * (1-timeline_height_inset_factor)/2 + timeline_timescale_height/2)+")"});

    var left_offset = -pregame_time - timeline_separator_width - timeline_separator_offset_labels;

    d3_elements["timeline-timescale"]   
        .append("svg:text")
                .attr({ "x": left_offset,
                    "y": 0,
                    "id": "timeline-timescale-label"})
                .text("Time");

    var minute_ticks = [];
    for(var i = -60; i <= game_length; i+=60)
        minute_ticks.push(i);

    var ticks = d3_elements["timeline-timescale"].selectAll(".timeline-timescale-tick").data(minute_ticks, function(d){return d;});

    ticks.enter()
        .append("g")
        .attr("class", "timeline-time-tick")
        .attr("transform", function(d){return "translate("+getTimelineTimeScale()(d)+", 0)";})
        .each(function(time){createTimelineTimeTick.call(this, time);});


    gui_state["timelines"] =
        [
            {"label": "Kills"},
            {"label": "Gold"},
            {"label": "Experience"},
            {"label": "Fights"},
        ];

    gui_state["active-sub-timelines"] = 4;

    updateTimeline();
}

function createTimelineTimeTick(time)
{
    var group = d3.select(this);

    group.append("svg:text")
        .attr({
            "class": "timeline-timescale-tick-label",
            "transform": "translate(0, 0)",
            })
        .text(formatTime(time));

    var line_length = timeline_height * timeline_height_inset_factor - timeline_timescale_height;
    
    group.append("svg:path")
        .attr({
            "class": "timeline-timescale-tick-line",
            "transform": "translate(0, "+(timeline_timescale_height/2)+")",

            "d": "M 0 0 L 0 "+ line_length
            });
}


function validateTimeCursor(time)
{
    return Math.min(Math.max(-pregame_time+gui_state["timeline-cursor-width"]/2, time), replay_data["header"]["length"] - gui_state["timeline-cursor-width"]/2);
}

function createSubTimeline(sub_timeline, index){
    var sub_timeline_height = (timeline_height * timeline_height_inset_factor - timeline_timescale_height) / gui_state["active-sub-timelines"];
    var top_offset = timeline_height * (1-timeline_height_inset_factor)/2 + timeline_timescale_height + sub_timeline_height/2;
    var left_offset = -pregame_time - timeline_separator_width - timeline_separator_offset_labels;

    var game_length = replay_data["header"]["length"];
    //sync with update

    d3.select(this)
        .attr("transform", "translate(0,"+(top_offset+index*sub_timeline_height)+")");
    if(index %2 == 0)
    {
        d3.select(this)
            .append("svg:rect")
            .attr({ "x": -timeline_inset_left-pregame_time,
                "y": -sub_timeline_height/2,
                "width": timeline_inset_left + pregame_time + game_length,
                "height": sub_timeline_height,
                "class": "sub-timeline-alternate-background"
                });
    }
    
    d3.select(this)     
        .append("svg:text")
                .attr({ "x": left_offset,
                    "y": 0,
                    "class": "sub-timeline-label"})
                .text(sub_timeline["label"]);

    var group = d3.select(this)
        .append("g");

    var axis_scale = getTimelineTimeScale();

    var minute_ticks = [];
    for(var i = -60; i <= game_length; i+=60)
        minute_ticks.push(i);

    var time_domain = [-pregame_time, game_length];

    switch(sub_timeline["label"])
    {

    case "Kills":
        d3.select(this).selectAll(".timeline-kill").data(replay_data["indices"]["kills"])
            .enter()
            .append("svg:circle")
            .attr({ "class": function(kill){ return "timeline-kill "+replay_data["events"][kill]["team"]},
                "r": timeline_kill_radius,
                "cx": function(kill){return getTimelineTimeScale()(replay_data["events"][kill]["time"]);},
                "cy": function(kill){return 0;}
                });


        break;

    case "Gold":
        var axis = d3.svg.axis()
                .scale(axis_scale)
                .tickFormat("")
                        .tickSize(0, 0);

        group.append("g")
            .attr("id", "sub-timeline-gold-axis")
            .call(axis);
        if(!replay_data.hasOwnProperty("timeseries"))
            break;
        var gold_data = replay_data["timeseries"]["gold-advantage"];

        generateGraph("sub-timeline-gold", group, gold_data, time_domain, [-sub_timeline_height/2, sub_timeline_height/2], [colors_greens[2], colors_reds[2]]);
        break;

    case "Experience":
        var axis = d3.svg.axis()    
                .scale(axis_scale)
                .tickFormat("")
                        .tickSize(0, 0);

        group.append("g")
            .attr("id", "sub-timeline-exp-axis")
            .call(axis);
        if(!replay_data.hasOwnProperty("timeseries"))
            break;
        var exp_data = replay_data["timeseries"]["exp-advantage"];

        generateGraph("sub-timeline-exp", group, exp_data, time_domain, [-sub_timeline_height/2, sub_timeline_height/2], [colors_greens[2], colors_reds[2]]);

        break;

    case "Fights":
        d3.select(this).selectAll(".timeline-fight").data(replay_data["indices"]["fights"])
            .enter()
            .append("svg:rect")
            .attr({ "class": function(fight){ return "timeline-kill "+replay_data["events"][fight]["team"]},
                "x": function(fight){return replay_data["events"][fight]["time_start"];},
                "y": -sub_timeline_height/2,
                "width": function(fight){return replay_data["events"][fight]["time_end"] - replay_data["events"][fight]["time_start"];},
                "height": sub_timeline_height,
                "fill": function(fight){return color_scale_fights(replay_data["events"][fight]["heroes_involved"].length);}
                });

        break;
    }

}

function getTimelineTimeScale()
{
    return d3.scale.linear()
                .domain([-pregame_time, 0, replay_data["header"]["length"]])
                .range([-pregame_time, 0, replay_data["header"]["length"]]);
}

function updateTimeline(){
    d3_elements["timeline-cursor"].attr('x', gui_state["cursor-time"]- gui_state["timeline-cursor-width"]/2);

    var sub_timelines = d3_elements["timeline-svg"].selectAll(".sub-timeline").data(gui_state["timelines"], function(timeline){
                    return timeline["label"];
                });
    sub_timelines.enter()
        .append("g")
        .attr("class", "sub-timeline")
        .each(createSubTimeline);

    sub_timelines.each(updateSubTimeline);

    sub_timelines.exit()
        .remove();
}

function updateSubTimeline(sub_timeline, index){
    //sync with create
    var sub_timeline_height = (timeline_height * timeline_height_inset_factor - timeline_timescale_height) / gui_state["active-sub-timelines"];
    var top_offset = timeline_height * (1-timeline_height_inset_factor)/2 + timeline_timescale_height + sub_timeline_height/2;
    var left_offset = -pregame_time - timeline_separator_width - timeline_separator_offset_labels;

    d3.select(this)
        .attr("transform", "translate(0,"+(top_offset+index*sub_timeline_height)+")");
}

/*
    Map
*/
function gamePositionToCoordinates(position)
{
    if(!position || position.length != 2)
    {
        console.log("bad position");
        console.log(position);
    }
    var scale_x = d3.scale.linear()
                .domain([-8200, 7930.0])
                .range([0, 100]);
    var scale_y = d3.scale.linear()
                .domain([-8400.0, 8080.0])
                .range([100, 0]);
    return new Victor(scale_x(position[0]), scale_y(position[1]));
}

function initMap(){
    d3_elements["map"] = d3.select("#map");

    d3_elements["map-svg"] = d3.select("#map")
                .append("svg")
                .attr({ "id": "map-svg",
                    "class": "svg-content",
                    "viewBox": "0 0 "+100+" "+100});

    d3_elements["map-svg"].append("svg:image")
                .attr({ "id": "map-background",
                    "xlink:href": "/static/img/minimap.png",
                    "x": "0",
                    "y": "0",
                    "width": "100",
                    "height": "100"
                    })
                .on("click", mapOnBackgroundClick);

    d3_elements["map-svg"].append("svg:text")
                .attr({ "id": "map-time",
                    "class": "map-time",
                    "transform": "translate(50, 5)"});


    if(DEBUG){
        d3_elements["map-svg"].selectAll("location").data(d3.entries(location_coordinates), function(d){return d.key;})
            .enter()
            .append("svg:circle")
                .attr({
                    "class": "location",
                    "cx": function(d){return d.value["x"];},
                    "cy": function(d){return d.value["y"];},
                    "r": 2,
                    "fill": "white"
                    });
    }
    d3_elements["map-svg"].append("g")
        .attr("id", "events");
    d3_elements["map-svg"].append("g")
        .attr("id", "paths");
    d3_elements["map-svg"].append("g")
        .attr("id", "units");
    updateMap();
}

function updateMap(){

    d3_elements["map-svg"].select("#map-time")
            .text(formatTime(gui_state["cursor-time"]));

    var map_events = d3_elements["map-svg"].select("#events").selectAll(".event")
                .data(d3.entries(replay_data["events"]).filter(function(d){return filterEventsMap(d.value)}),
                    function(entry){
                        return entry.key;
                        });
    map_events.enter()
        .append("g")
            .attr({ "class": "event"
                })
            .each(function(entry){createMapEvent.call(this, entry.value);});

    map_events.each(function(entry){updateMapEvent.call(this, entry.value);});

    map_events.exit()
        .remove();

    var unit_paths = d3_elements["map-svg"].select("#paths").selectAll(".path")
                .data(gui_state["visible-unit-histories"], function(id){return id;});
    unit_paths.enter()
        .append("g")
            .attr({ "class": "path"
                })
            .each(function(id){createMapPath.call(this, id);});

    unit_paths.each(function(id){updateMapPath.call(this, id);});

    unit_paths.exit()
        .remove();

    var map_units = d3_elements["map-svg"].select("#units").selectAll(".unit")
                .data(d3.entries(replay_data["entities"]).filter(function(d){return filterUnitsMap(d.value)}),
                    function(entry){
                        return entry.key;
                        });
    map_units.enter()
        .append("g")
            .attr({ "class": "unit"
                })
            .each(function(entry){createMapUnit.call(this, entry);});

    map_units.each(function(entry){updateMapUnit.call(this, entry);});

    map_units.exit()
        .each(function(entry){deleteMapUnit.call(this, entry);})
        .remove();
}

function filterEventsMap(event){
    if(map_events.indexOf(event["type"]) == -1)
        return false;
    
    if(event.hasOwnProperty("time"))
    {
        if( ! ((event["time"]-event_duration/2 <= gui_state["cursor-time"]) &&
            (event["time"]+event_duration/2 > gui_state["cursor-time"])) )
            return false;
    }
    else if(event.hasOwnProperty("time_start") && event.hasOwnProperty("time_end"))
    {
        if( ! (event["time_end"] > gui_state["cursor-time"] &&  
            event["time_start"] <= gui_state["cursor-time"]) )
            return false;

    }
    else
    {
        console.log("Corrupted event");
        return false;
    }

    /*if(event.hasOwnProperty("time"))
    {
        if( ! (event["time"] >= (gui_state["cursor-time"] - gui_state["timeline-cursor-width"]/2) &&
            event["time"] <= (gui_state["cursor-time"] + gui_state["timeline-cursor-width"]/2) ) )
            return false;
    }
    else if(event.hasOwnProperty("time_start") && event.hasOwnProperty("time_end"))
    {
        if( ! (event["time_end"] >= (gui_state["cursor-time"] - gui_state["timeline-cursor-width"]/2) &&  
            event["time_start"] <= (gui_state["cursor-time"] + gui_state["timeline-cursor-width"]/2) ) )
            return false;

    }
    else
    {
        console.log("Corrupted event");
        return false;
    }*/

    return true;
}

function filterUnitsMap(unit){
    //TODO: filter unit type

    var segment_id = getUnitPositionSegment(unit);

    if(segment_id == -1)
        return false;
    else return true;
    
}

function getUnitPositionSegment(unit)
{
    var current_time = gui_state["cursor-time"];
    var segment_id = -1;
    for(i in unit["position"])
    {
        if(current_time >= unit["position"][i]["time-start"] && current_time < unit["position"][i]["time-end"])
        {
            segment_id = i;
            break;
        }
    }
    return segment_id;
}

function createMapEvent(event){

    var group = d3.select(this);
    //console.log("Creating event ", event);

    
    var location;
    if(event.hasOwnProperty("location") ||event.hasOwnProperty("position"))
    {   

        location = group.append("svg:circle")
            .attr({
                "class": "event-background",
                "cx": 0,
                "cy": 0,
                "r": 8,
                "opacity": computeEventOpacity(event)
                });
    }


    switch(event["type"])
    {
    case "fight":
        location.attr({
            "fill": color_scale_fights(event["heroes_involved"].length),
            });
        break;
    case "movement":
        location.attr({
            "fill": "lightblue"//color_scale_fights(colors_blues[0]),
            });
        break;
    case "fountain-visit":
        location.attr({
            "fill": "white",
            });
        break;
    case "jungling":
        location.attr({
            "fill": colors_beiges[3],
            });
        break;
    case "laning":
        location.attr({
            "fill": "grey",
            });
        break;
    case "rotation":
        var coordinates_start = getLocationCoordinates(event["location-start"]);
        var coordinates_end = getLocationCoordinates(event["location-end"]);
        var coordinates_center = coordinates_start.clone().add(coordinates_end).multiplyScalar(0.5);

        group.attr({
            "transform": "translate("+coordinates_center.x+","+coordinates_center.y+")"
            });
        location = group.append("svg:path")
            .attr({
                "class": "event-background",
                "d": createRotationPath(event),
                "fill": team_color[replay_data["entities"][event["involved"][0]]["side"]],
                "stroke": "black",
                "stroke-width": (event["rotation-type"] == "teleport")? 1 : 0,
                "opacity": computeEventOpacity(event)
                });
        break;
    case "creep_death":
        color = "";
        switch(event["team"])
        {
            case "radiant":
                color= colors_greens[2];
                break;
            case "dire":
                color= colors_reds[2];
                break;
            case "neutral":
                color= colors_yellows[2];
                break;
        }
        location.attr({
            "r": icon_size*0.5,
            "fill": color
            });
        break;
    default:
        console.log("unknown map event type", event);
    }

    updateMapEvent.call(this,event);
}

function computeEventOpacity(event)
{
    return 0.7;
/*
    var time_distance = 0;
    if(event.hasOwnProperty("time"))
    {
        time_distance = Math.abs(gui_state["cursor-time"] - event["time"]);

    }
    else if(event.hasOwnProperty("time_start") && event.hasOwnProperty("time_end"))
    {
        time_distance = Math.abs(Math.min(0, gui_state["cursor-time"] - event["time_start"])) +
                    Math.abs(Math.max(0, gui_state["cursor-time"] - event["time_end"]))
                ;
    }
    time_distance = Math.max(0, time_distance - event_duration);
    var normalized_distance = Math.min(1,time_distance/((gui_state["timeline-cursor-width"]-event_duration)/2));
    return (1-normalized_distance)*event_maximum_opacity;*/
}

function createMapUnit(entry)
{
    var group = d3.select(this);

    var entity = replay_data["entities"][entry.key];
    group.append("svg:circle")
        .attr({
            "cx": 0,
            "cy": 0,
            "r": icon_size*0.75,
            "fill": team_color[entity["side"]]
            })
        .on("click", mapOnUnitClick);

    group.append("svg:image")
        .attr({
            "xlink:href": icon_images[entity["unit"]],
            "x": -0.5*icon_size,
            "y": -0.5*icon_size,
            "width": icon_size,
            "height": icon_size,
            "pointer-events": "none"
            });

    if(entity.hasOwnProperty("control"))
    {
        group.append("svg:text")
            .attr({
                "x": 0,
                "y": -0.5*icon_size,
                "class": "icon-label"
                });
            //TODO: 
            //.text(replay_data["header"]["players"][entity["control"]]["name"]);
    }

    updateMapUnit.call(this,entry);
}

function getEntityPosition(entity_id)
{
    return getEntityPositionAtTime(entity_id, gui_state["cursor-time"])
}

function getEntityPositionAtTime(entity_id, time)
{
    //console.log("getting pos", entity_id);
    var entity = replay_data["entities"][entity_id];
    //console.log("unit", entity["unit"]);
    var current_time = time;
    var segment_id = getUnitPositionSegment(entity);
    //console.log("segments ", entity["position"].length, "segid", segment_id);
    if(segment_id >= 0)
    {   //console.log("getting pos "+entity_id+" "+current_time+" s"+segment_id);
        var position = getTimeseriesValue(entity["position"][segment_id]["timeseries"], current_time);
        return position;
    }
    else 
    {
        console.log("getting bad position "+entity_id+" "+current_time+" s"+segment_id);
        return null;
    }
}

function createRotationPath(event)
{
    var coordinates_start = getLocationCoordinates(event["location-start"]);
    var coordinates_end = getLocationCoordinates(event["location-end"]);
    var coordinates_center = coordinates_start.clone().add(coordinates_end).multiplyScalar(0.5);
    coordinates_start.subtract(coordinates_center);
    coordinates_end.subtract(coordinates_center);

    var direction = coordinates_end.clone().subtract(coordinates_start).normalize();
    var direction_normal = direction.clone().rotateDeg(90);

    var v1 = coordinates_start.clone()
            .add(direction.clone().multiplyScalar(rotation_offset))
            .add(direction_normal.clone().multiplyScalar(rotation_width));
    var v2 = coordinates_end.clone()
            .add(direction.clone().multiplyScalar(-rotation_offset));
    var v3 = coordinates_start.clone()
            .add(direction.clone().multiplyScalar(rotation_offset))
            .add(direction_normal.clone().multiplyScalar(-rotation_width));
    return "M "+v1.x+" "+v1.y+" L "+v2.x+" "+v2.y+" L "+v3.x+" "+v3.y+" z";
}

function updateMapEvent(event){
    var group = d3.select(this);

    group.select(".event-background")
        .attr({"opacity": computeEventOpacity(event)});

    //var position = getLocationCoordinates(event["location"]);
    var position = new Victor(0,0);
    var units_available = 0;
    if(event.hasOwnProperty("involved"))
    {
        for(var involved_i in event["involved"])
        {
            var unit_position = getEntityPosition(event["involved"][involved_i]);
            if(unit_position)
            {
                position.add(new Victor(unit_position[0], unit_position[1]));
                units_available += 1;
            }
        }
        position.multiplyScalar(1/event["involved"].length);
    }
    var coords;
    if(units_available >0)
        coords = gamePositionToCoordinates([position.x, position.y]);
    else
        coords = new Victor(5,5);
    if(event.hasOwnProperty("position"))
        coords = gamePositionToCoordinates(event["position"]);

    group.attr({
            "transform": "translate("+coords.x+","+coords.y+")"
            });
}

function updateMapUnit(entry)
{

    //console.log("Updating "+entry.key+" "+gui_state["cursor-time"]);
    var group = d3.select(this);

    var position = getEntityPosition(entry.key);
    //console.log("pos ", position);
    var coordinates;
    if(position)
        coordinates = gamePositionToCoordinates(position);
    else
        coordinates = new Victor(5,5);

    group.attr({
        "transform": "translate("+coordinates.x+","+coordinates.y+")"
        });
}

function deleteMapUnit(entry)
{
    //console.log("deleting "+ entry.key);
}

function createMapPath(id)
{
    var group = d3.select(this);
    group.append("svg:path")
        .attr({
            "id": "position-history-past",
            "stroke": "black",
            "stroke-width": 1.5,
            "opacity": 0.4,
            "fill": "none"
            });

    group.append("svg:path")
        .attr({
            "id": "position-history-future",
            "stroke": "black",
            "stroke-width": 1.5,
            "opacity": 0.7,
            "fill": "none"
            });
}

function updateMapPath(id)
{
    var group = d3.select(this);
    var unit = replay_data["entities"][id];
    var segment_id = getUnitPositionSegment(unit);
    if(segment_id < 0)
    {
        group.select("#position-history-past")
            .attr("d", "");
        group.select("#position-history-future")
            .attr("d", "");
    }
    else
    {
        var line_formatter = d3.svg.line()
                .x(function(d) {return gamePositionToCoordinates(d["v"]).x;})
                .y(function(d) {return gamePositionToCoordinates(d["v"]).y;})
                .interpolate('cardinal');

        var past_end = {
            "t": gui_state["cursor-time"] - gui_state["timeline-cursor-width"]/2,
            "v": getEntityPositionAtTime(id, gui_state["cursor-time"] - gui_state["timeline-cursor-width"]/2)};
        var now = {
            "t": gui_state["cursor-time"],
            "v": getEntityPositionAtTime(id, gui_state["cursor-time"])};
        var future_end = {
            "t": gui_state["cursor-time"] + gui_state["timeline-cursor-width"]/2,
            "v": getEntityPositionAtTime(id, gui_state["cursor-time"] + gui_state["timeline-cursor-width"]/2)};

        var past_history = getTimeseriesSamples(unit["position"][segment_id]["timeseries"],                         function(sample)
                    {
                        if(sample["t"] >= gui_state["cursor-time"] - gui_state["timeline-cursor-width"]/2  && sample["t"] < gui_state["cursor-time"])
                            return true;
                        else
                            return false;
                    });

        past_history.unshift(past_end);
        past_history.push(now);


        var future_history = getTimeseriesSamples(unit["position"][segment_id]["timeseries"],                       function(sample)
                    {
                        if(sample["t"] >= gui_state["cursor-time"] && sample["t"] < gui_state["cursor-time"] + gui_state["timeline-cursor-width"]/2)
                            return true;
                        else
                            return false;
                    });
        future_history.unshift(now);
        future_history.push(future_end);

        group.select("#position-history-past")
            .attr("d", line_formatter(past_history));

        group.select("#position-history-future")
            .attr("d", line_formatter(future_history));
    }
}


/*
    Diagram
*/

function initDiagram(){
    /*loadSVG("img/diagram.svg", "diagram", 
            function()
            {
                svgPanZoom('#diagram-svg', {
                    zoomEnabled: true,
                    controlIconsEnabled: true
                    });

            });*/

    d3_elements["diagram-svg"] = d3.select("#content")
                    .append("div")
                    .attr("class","svg-container")
                        .append("svg")
                        .attr({ "id": "diagram-svg",
                            "class": "svg-content",
                            "viewBox": "-"+diagram_inset_left+" 0 "+(diagram_display_width+diagram_inset_left+diagram_inset_right)+" "+diagram_height});

    d3_elements["diagram-background-layer"] = d3_elements["diagram-svg"].append("g").attr("id", "background-layer");
    d3_elements["diagram-background-layer"].append("svg:rect")
                    .attr({ "id": "diagram-separator",
                        "x": (-diagram_separator_width),
                        "y": 0,
                        "width": diagram_separator_width,
                        "height": diagram_height
                    });
    d3_elements["diagram-background-layer"].append("g").attr("id", "location-lines");
    d3_elements["diagram-background-layer"].append("g").attr("id", "time-ticks");
    d3_elements["diagram-interactive-areas"] = d3_elements["diagram-background-layer"].append("g")
                    .attr("id", "interactive-areas");

    d3_elements["diagram-events-layer"] = d3_elements["diagram-svg"].append("g").attr("id", "events-layer");

    d3_elements["diagram-overlay-layer"] = d3_elements["diagram-svg"].append("g").attr("id", "overlay-layer");
    d3_elements["diagram-history-lines"] = d3_elements["diagram-overlay-layer"].append("g").attr("id", "history-lines");
    d3_elements["diagram-icons"] = d3_elements["diagram-overlay-layer"].append("g").attr("id", "icons");

    d3_elements["diagram-svg"].append("g").attr("id", "cursor-layer");
    


    d3_elements["diagram-cursor"] = d3_elements["diagram-svg"].select("#cursor-layer")
                .append('svg:rect')
                .attr({
            'id': 'diagram-cursor',
            'x': 0,//overridden by time
                    'y': diagram_inset_top,
                    'width': gui_state["timeline-cursor-width"] * ((diagram_display_width-2*diagram_display_inset)/diagram_time_displayed),
                    'height': diagram_height - diagram_inset_top
            });

    d3_elements["diagram-timescale"] = d3_elements["diagram-background-layer"].append("g")
        .attr("id", "diagram-timescale");



    gui_state["location-lines-count"] = 7;

    gui_state["diagram-events"] = ["fight", "movement", "fountain-visit", "jungling", "laning"];
    
    var diagram_time_scale = getDiagramTimeScale();

    d3_elements["diagram-interactive-areas"]
        .append("svg:rect")
        .attr({"id": "diagram-clickable-background",
            "class": "interactive-area",
            "x": diagram_time_scale.range()[0],
            "y": 0,
            "width": diagram_time_scale.range()[1] - diagram_time_scale.range()[0],
            "height": diagram_height,
            "opacity": 0})
        .on({"click": diagramOnClickPickTime
            });

    d3_elements["diagram-interactive-areas"]
        .append("svg:rect")
        .attr({"id": "diagram-clickable-scroll-left",
            "class": "interactive-area",
            "x": 0,
            "y": 0,
            "width": diagram_display_inset,
            "height": diagram_height})
        .on({"click": diagramOnClickScrollLeft
            });

    d3_elements["diagram-interactive-areas"]
        .append("svg:rect")
        .attr({"id": "diagram-clickable-scroll-right",
            "class": "interactive-area",
            "x": diagram_time_scale.range()[1],
            "y": 0,
            "width": diagram_display_inset,
            "height": diagram_height})
        .on({"click": diagramOnClickScrollRight
            });

    updateDiagram();
}


function updateDiagram()
{

    
    var time_scale = getDiagramTimeScale();

    var location_lines =d3_elements["diagram-background-layer"].select("#location-lines").selectAll(".location-line").data(gui_state["location-lines"], function(location_line){
                    return location_line["label"];
                });
    location_lines.enter()
        .append("g")
        .attr("class", "location-line")
        .each(function(location_line){createLocationLine.call(this, location_line);});

    location_lines.each(function(location_line){updateLocationLine.call(this, location_line);});

    location_lines.exit()
        .remove();

    var ticks = d3_elements["diagram-timescale"].selectAll(".diagram-time-tick").data(generateTimeTicks(), function(d){return d;});

    ticks.enter()
        .append("g")
        .attr("class", "diagram-time-tick")
        .attr("transform", function(d){return "translate("+time_scale(d)+", 0)";})
        .each(function(time){createDiagramTimeTick.call(this, time);});

    ticks.attr({
        "transform": function(d){return "translate("+time_scale(d)+",0)";}
        });

    ticks.exit().remove();

    d3_elements["diagram-cursor"]
        .attr("x", time_scale(gui_state["cursor-time"]-gui_state["timeline-cursor-width"]/2));




    var events = d3_elements["diagram-events-layer"].selectAll(".diagram-event").data(
                        d3.entries(replay_data["diagram-events"]).filter(function(d){return filterEventsDiagram(d.value)})
                        , function(event_entry){return event_entry.key;});

    events.enter()
        .append("g")
        .attr("class", "diagram-event")
        .each(function(event_entry){createDiagramEvent.call(this, event_entry);});

    events.each(function(event_entry){updateDiagramEvent.call(this, event_entry);});

    events.exit()
        .remove();

    var selected_data = [];
    if(gui_state["selected-event"]) 
        selected_data.push(gui_state["selected-event"]);

    var selected = d3_elements["diagram-icons"].selectAll(".selected-event").data(selected_data, function(d){return d;});

    selected.enter()
        .append("g")
        .attr("class", "selected-event")
        .each(function(d){createSelectedEvent.call(this, d);})

    selected
        .each(function(d){updateSelectedEvent.call(this, d);})

    selected.exit()
        .remove();

    var histories = d3_elements["diagram-history-lines"].selectAll(".history-line").data(gui_state["visible-unit-histories"], function(d){return d;});
    histories.enter()
        .append("g")
        .attr("class", "history-line")
        .each(function(d){createDiagramHistory.call(this, d);})

    histories
        .each(function(d){updateDiagramHistory.call(this, d);})

    histories.exit()
        .remove();

}

function generateTimeTicks()
{
    var time_scale = getDiagramTimeScale();
    var tick_min = Math.ceil(time_scale.domain()[0]/diagram_tick_interval);
    var tick_max = Math.floor(time_scale.domain()[1]/diagram_tick_interval);
    var result = [];
    for(var i = tick_min; i <= tick_max; i++)
    {
        result.push(i*diagram_tick_interval);
    }

    return result;
}

function getDiagramTimeScale()
{
    var time_scale = d3.scale.linear()

    if(gui_state["cursor-time"] - diagram_time_displayed/2 < -pregame_time)
    {
        time_scale.domain([-pregame_time, diagram_time_displayed-pregame_time]);
    }
    else if(gui_state["cursor-time"] + diagram_time_displayed/2 > replay_data["header"]["length"])
    {
        time_scale.domain([replay_data["header"]["length"] - diagram_time_displayed, replay_data["header"]["length"]]);
    }
    else
    {
        time_scale.domain([gui_state["cursor-time"] - diagram_time_displayed/2, gui_state["cursor-time"] + diagram_time_displayed/2]);
    }
    time_scale.range([0+diagram_display_inset, diagram_display_width-diagram_display_inset]);

    return time_scale;
}

function getDiagramTimeToLengthRatio()
{

    var scale = getDiagramTimeScale();
    var ratio = (scale.range()[1] - scale.range()[0])/(scale.domain()[1] - scale.domain()[0]);
    return ratio;
}

function createDiagramTimeTick(time)
{
    var group = d3.select(this);

    group.append("svg:text")
        .attr({
            "class": "diagram-time-tick-label",
            "transform": "translate(0, "+diagram_inset_top/2+")",
            })
        .text(formatTime(time));

    var line_length = diagram_height - diagram_inset_top;
    
    group.append("svg:path")
        .attr({
            "class": "diagram-time-tick-line",
            "transform": "translate(0, "+diagram_inset_top+")",
            "d": "M 0 0 L 0 "+ line_length
            });
}

function createLocationLine(location_line)
{
    var group = d3.select(this);

    var location_line_height = (diagram_height - diagram_inset_top)/gui_state["location-lines-count"];

    group.attr({
        "transform": "translate(0, "+(location_line_height*(location_line["layout-nr"]+0.5) + diagram_inset_top)+")"
        });
    group.append("svg:text")
        .attr({
            "class": "diagram-location-line-label",
            "transform": "translate(-"+(diagram_inset_left/2)+", 0)",
            })
        .text(location_line["label"]);

    var line_length = diagram_display_width;
    
    group.append("svg:path")
        .attr({
            "class": "diagram-location-line",
            "d": "M 0 0 L "+line_length+" 0"
            });
}
function updateLocationLine(location_line)
{
    var group = d3.select(this);
}


function filterEventsDiagram(event)
{
    if(gui_state["diagram-events"].indexOf(event["type"]) == -1)
        return false;
    
    if(event.hasOwnProperty("time"))
    {
        return  event["time"] >= getDiagramTimeScale().domain()[0] &&
            event["time"] <= getDiagramTimeScale().domain()[1];
    }
    else if(event.hasOwnProperty("time_start") && event.hasOwnProperty("time_end"))
    {
        return  event["time_end"] >= getDiagramTimeScale().domain()[0] &&  
            event["time_start"] <= getDiagramTimeScale().domain()[1];
    }
    else
    {
        console.log("Corrupted event");
        return false;
    }
}


function filterEventIDsDiagram(event_id)
{
    return filterEventsDiagram(replay_data["events"][event_id]);
}

function createDiagramEvent(entry)
{
    var event = entry.value;
    var group = d3.select(this);
    
    if(event.hasOwnProperty("time_start") && event.hasOwnProperty("time_end"))
    {

        group.append("svg:rect")
            .attr({ "class": "diagram-event-background",
                "stroke-width": 0
                })
            .on("click", function(event_entry){diagramEventOnClick.call(this, entry.key);});
    }

    switch(event["type"])
    {
    case "fight":
        group.selectAll(".diagram-event-background")
            .attr({
            "fill": color_scale_fights(event["heroes_involved"].length),
            });
        break;
    case "movement":
        group.selectAll(".diagram-event-background")
            .attr({
            "fill": "lightblue"//color_scale_fights(colors_blues[0]),
            });
        break;
    case "fountain-visit":
        group.selectAll(".diagram-event-background")
            .attr({
            "fill": "white",
            });
        break;
    case "jungling":
        group.selectAll(".diagram-event-background")
            .attr({
            "fill": colors_beiges[3],
            });
        break;
    case "laning":
        group.selectAll(".diagram-event-background")
            .attr({
            "fill": "grey",
            });
        break;
    }


    updateDiagramEvent.call(this, entry);
}


function updateDiagramEvent(entry)
{
    var event = entry.value;
    var group = d3.select(this);
    var center_time = getEventTime(event);
    
    if(event.hasOwnProperty("location"))
    {
        group.attr("transform", "translate("+getDiagramTimeScale()(center_time)+","+getDiagramY(event["location"])+")");
    }
    else
    {
        group.attr("transform", "translate("+getDiagramTimeScale()(center_time)+","+getDiagramY("midlane-betweeen-t1s")+")");
    }

    var timescale = getDiagramTimeScale();
    var start = Math.max(timescale.domain()[0], event["time_start"]);
    var end = Math.min(timescale.domain()[1], event["time_end"]);
    var location_line_height = (diagram_height - diagram_inset_top)/gui_state["location-lines-count"];

    var height = location_line_height*(1-diagram_event_height_margins)/event["group-size"];
    var vertical_offset = height*event["group-i"] + (event["group-i"]+1)*location_line_height*(diagram_event_height_margins/(event["group-size"]+1));
    var background = group.selectAll(".diagram-event-background")
            .attr({ "class": "diagram-event-background",
                "x": timescale(start) - timescale((event["time_start"]+event["time_end"])/2),
                "y": -location_line_height/2 + vertical_offset,
                "width": timescale(end)-timescale(start),
                "height": height,
                "stroke-width": (gui_state["selected-event"] == entry.key ? 3 : 0)
                });
}

function computeDiagramEventPosition(event_id)
{
    var event = replay_data["diagram-events"][event_id];
    var center_time = getEventTime(event);

    var location_line_height = (diagram_height - diagram_inset_top)/gui_state["location-lines-count"];

    var height = location_line_height*(1-diagram_event_height_margins)/event["group-size"];
    var vertical_center_offset = height*(event["group-i"]+0.5) + (event["group-i"]+1)*location_line_height*(diagram_event_height_margins/(event["group-size"]+1));
    
    return [getDiagramTimeScale()(center_time), getDiagramY(event["location"])-location_line_height/2 +vertical_center_offset];
}

function createSelectedEvent(event_id)
{
    var group = d3.select(this);
    var icons = group.append("g").attr("id", "icons-group");

    var list_involved = replay_data["diagram-events"][event_id]["involved"];
    if(list_involved)
    {
        var left_offset = diagram_icon_size * list_involved.length /2;
        for(i in list_involved)
        {

            icons.append("svg:image")
                .attr({
                    "xlink:href": icon_images[ replay_data["entities"][list_involved[i]]["unit"] ],
                    "x": -left_offset+i*diagram_icon_size,
                    "y": -0.5*diagram_icon_size,
                    "width": diagram_icon_size,
                    "height": diagram_icon_size,
                    });
        }
    }
}

function getEventTime(event)
{
    if(event.hasOwnProperty("time"))
    {
        return event["time"];
    }
    else if(event.hasOwnProperty("time_start") && event.hasOwnProperty("time_end"))
    {
        return (event["time_start"]+event["time_end"])/2;
    }
    else
    {
        console.log("Corrupted event");
        return 0;
    }
}

function updateSelectedEvent(event_id)
{
    var event = replay_data["diagram-events"][event_id];
    var group = d3.select(this);
    var center_time = getEventTime(event);
    var position = computeDiagramEventPosition(event_id);
    group.select("#icons-group").attr("transform", "translate("+position[0]+","+position[1]+")");
    
}

function createDiagramHistory(id)
{
    var group = d3.select(this);
    group.append("svg:path")
        .attr({
            "id": "history-line",
            "stroke": "black",
            "stroke-width": 4,
            "opacity": 1,
            "fill": "none"
            })
        .on("click", diagramOnHistoryClick);

    group.append("svg:image")
        .attr({
            "id": "icon",
            "xlink:href": icon_images[ replay_data["entities"][id]["unit"]],
            "x": -0.5*diagram_icon_size,
            "y": -0.5*diagram_icon_size,
            "width": diagram_icon_size,
            "height": diagram_icon_size,
            })
        .on("click", diagramOnHistoryClick);
}

function updateDiagramHistory(id)
{
    var group = d3.select(this);
    var unit = replay_data["entities"][id];

    var line_formatter = d3.svg.line()
            .x(function(d) {return getDiagramTimeScale()(d["t"]);})
            .y(function(d) {return getDiagramY(d["v"]);})
            .interpolate('basis');


    var events = replay_data["indices"]["by-entity"][id].filter(filterEventIDsDiagram);

    var samples = [];
    var diagram_timescale = getDiagramTimeScale();
    for(var event_i in events)
    {
        var event = replay_data["events"][events[event_i]];
        console.log(event);
        if(gui_state["diagram-events"].indexOf(event["type"]) == -1)
            continue;

        if(event.hasOwnProperty("time"))
        {
            samples.push({
                    "t": event["time"],
                    "v": event["location"]});
        }
        else if(event.hasOwnProperty("time_start") && event.hasOwnProperty("time_end"))
        {
            var sample_left = {
                    "t": event["time_start"],
                    "v": event["location"]};
            var sample_right = {
                    "t": event["time_end"],
                    "v": event["location"]};

            if(event["time_start"] <= diagram_timescale.domain()[0] &&
                event["time_end"] > diagram_timescale.domain()[0])
            {
                sample_left["t"] = diagram_timescale.domain()[0];
            }
            if(event["time_start"] <= diagram_timescale.domain()[1] &&
                event["time_end"] > diagram_timescale.domain()[1])
            {
                sample_right["t"] = diagram_timescale.domain()[1];
                console.log("adjusted right");
            }
            samples.push(sample_left);
            samples.push(sample_right);
        }
    }

    samples.sort(function(a,b){return a["t"] - b["t"];});

    group.select("#history-line")
        .attr("d", line_formatter(samples));

    if(gui_state["highlighted-unit"] == id)
    {
        var player = unit["control"];
        group.select("#history-line").attr("stroke", colors_players[player]);
    }
    else
    {
        group.select("#history-line").attr("stroke", "black");
    }
    
    group.select("#icon").attr("transform", "translate("+getDiagramTimeScale()(gui_state["cursor-time"])+","+
                findYatXbyBisection(getDiagramTimeScale()(gui_state["cursor-time"]), group.select("#history-line").node(), 0.1)+")");
}


function findYatXbyBisection (x, path, error){
  var length_end = path.getTotalLength()
    , length_start = 0
    , point = path.getPointAtLength((length_end + length_start) / 2) // get the middle point
    , bisection_iterations_max = 50
    , bisection_iterations = 0

  error = error || 0.01

  while (x < point.x - error || x > point.x + error) {
    // get the middle point
    point = path.getPointAtLength((length_end + length_start) / 2)

    if (x < point.x) {
      length_end = (length_start + length_end)/2
    } else {
      length_start = (length_start + length_end)/2
    }

    // Increase iteration
    if(bisection_iterations_max < ++ bisection_iterations)
      break;
  }
  return point.y
}


function getDiagramY(location)
{
    var location_line_height = (diagram_height - diagram_inset_top)/gui_state["location-lines-count"];

    return (getLocationLine(location)+0.5)*location_line_height + diagram_inset_top;
}

function formatTime(time)
{
    var prefix = "";
    if(time < 0)
    {
        time = -time;
        prefix= "-";
    }
    time = Math.floor(time);
    return prefix+Math.trunc(time/60)+":"+(time - 60*Math.trunc(time/60));
}

/*
    UI interactions
*/

function mapOnBackgroundClick()
{
    gui_state["visible-unit-histories"] = [];
    gui_state["highlighted-unit"] = null;
    updateVisualisation();
}

function mapOnUnitClick(entry)
{
    gui_state["visible-unit-histories"] = [entry.key];
    gui_state["highlighted-unit"] = entry.key;
    updateVisualisation();
}


function diagramEventOnClick(event_id)
{
    gui_state["selected-event"] = event_id;
    /*if(replay_data["diagram-events"][gui_state["selected-event"]].hasOwnProperty("involved"))
        gui_state["visible-unit-histories"] = replay_data["diagram-events"][gui_state["selected-event"]]["involved"];*/

    var centered_time = 0;
    var event = replay_data["diagram-events"][gui_state["selected-event"]];
    var center_time = getEventTime(event);  
    gui_state["cursor-time"] = center_time;

    updateVisualisation();
}

function diagramOnHistoryClick(entity_id)
{
    gui_state["highlighted-unit"] = entity_id;
    updateVisualisation();
}

function diagramOnClickPickTime(d){
    gui_state["cursor-time"] = validateTimeCursor(getDiagramTimeScale().invert(d3.mouse(this)[0]));
    gui_state["selected-event"] = null;
    gui_state["visible-unit-histories"] = [];
    updateVisualisation();
}

function diagramOnClickScrollLeft(d){
    gui_state["cursor-time"] = validateTimeCursor(gui_state["cursor-time"]-diagram_time_displayed/2);
    updateVisualisation();
}

function diagramOnClickScrollRight(d){
    gui_state["cursor-time"] = validateTimeCursor(gui_state["cursor-time"]+diagram_time_displayed/2);
    updateVisualisation();
}


function toggleAutoScroll()
{
    gui_state["autoscroll-enabled"] = !gui_state["autoscroll-enabled"];
    d3.select("#play-button").text(gui_state["autoscroll-enabled"]?"Pause":"Play");
    d3.select("#play-button").attr("class", gui_state["autoscroll-enabled"]?"btn btn-default btn-lg glyphicon glyphicon-pause":"btn btn-default btn-lg glyphicon glyphicon-play");
}

function togglePlayer(player)
{
    var index = parseInt(player.dataset["id"]);
    gui_state["visible-players"][index] = !gui_state["visible-players"][index];
    updateVisualisation();
}

function loadSVG(file, id, callback)
{
    d3.xml(file, "image/svg+xml", function(xml) {
            var imported_node = document.importNode(xml.documentElement, true);
            var svg_id = id + "-svg";
            imported_node.setAttribute("id", svg_id);
            var id_string = "#"+id;
            d3.select(id_string).node().appendChild(imported_node);
            d3.select("#"+svg_id).attr({
            "class": "svg-content"
          });
            callback();         
        });
}



function initContent()
{
    /*
    clearContent();
    console.log("init",gui_state["content-selected"]);
    switch(gui_state["content-selected"])
    {
        case "events":
            initEvents();
            break;
        case "overview":
            initOverview();
            break;
        case "diagram":
            initDiagram();
            break;
    }

    updateContent();
    */
}

function clearContent()
{
    d3.selectAll("#content *")
        .remove();    
}

function updateContent()
{
    /*
    var content_buttons = d3.selectAll(".content-button").data(content_types);
    
    content_buttons.enter()
        .append("button")
        .each(createContentButton);

    content_buttons
        .each(updateContentButton);

    switch(gui_state["content-selected"])
    {
        case "events":
            updateEvents();
            break;
        case "overview":
            updateOverview();
            break;
        case "diagram":
            updateDiagram();
            break;
    }
*/
}

function createContentButton(content)
{
    var button = d3.select(this);

    button.attr({
                "type":"button",
                "class":"btn btn-default dashboard-button content-button"})
        .text(capitalizeFirstLetter(content));
}

function updateContentButton(content)
{
    var button = d3.select(this);
    if(gui_state["content-selected"] === content)
    {
        button
            .classed("btn-default", false)
            .classed("btn-info", true)
            .on("click", function(){});
    }
    else
    {
        button
            .classed("btn-default", true)
            .classed("btn-info", false)
            .on("click", function(){console.log("changed to", content);gui_state["content-selected"] = content; initContent();});
    }
}


function initEvents()
{
    var mydiv = d3.select("#content")
        .append("div")
        .attr("id", "events");

    var table = mydiv.append("table");
    var header = table.append("thead")
        .append("tr");
    header.append("th")
        .text("Time")
    header.append("th")
        .text("Event")

    d3_elements["events-table"] = table.append("tbody");
}

function updateEvents()
{
    var events = [];

    var events = d3_elements["events-table"].selectAll(".event-row").data(d3.entries(replay_data["events"]).filter(function(d){return filterEvents(d.value)})
                        , function(event_entry){return event_entry.key;});

    events.enter()
        .append("tr")
        .attr("class", "event-row")
        .each(function(d){createEvent.call(this, d);});

    events.order(function(a,b){return compareEventsByTime(a.value, b.value)});

    events
        .each(function(d){updateEvent.call(this, d);})

    events.exit()
        .remove();

}

list_events_excluded = ["laning", "movement", "jungling", "fountain-visit", "unit-selection", "creep-death"];
function filterEvents(event)
{
    if(list_events_excluded.indexOf(event["type"]) != -1)
        return false;
    
    if(event.hasOwnProperty("time"))
    {
        if( ! ((event["time"]-event_duration/2 <= gui_state["cursor-time"]) &&
            (event["time"]+event_duration/2 > gui_state["cursor-time"])) )
            return false;
    }
    else if(event.hasOwnProperty("time_start") && event.hasOwnProperty("time_end"))
    {
        if( ! (event["time_end"] > gui_state["cursor-time"] &&  
            event["time_start"] <= gui_state["cursor-time"]) )
            return false;

    }
    else
    {
        console.log("Corrupted event");
        return false;
    }
    return true;
}

function createEvent(entry)
{
    var event = entry.value;
    var row = d3.select(this);
    var time = row.append("td")
        .attr({"width":"20%"});
    if(event.hasOwnProperty("time"))
    {
        time.text(formatTime(event["time"]));
    }
    else if(event.hasOwnProperty("time_start") && event.hasOwnProperty("time_end"))
    {
        time.text(formatTime(event["time_start"])+" until "+formatTime(event["time_end"]));
    }

    var text = row.append("td")
                    .attr({"width":"50%"})
                    .text(JSON.stringify(event));

}

function updateEvent(entry)
{
    
}

function initOverview()
{
    var mydiv = d3.select("#content")
        .append("div")
        .attr("id", "overview");

    d3_elements["overview-table"] = mydiv.append("table");

    var rows = d3_elements["overview-table"].selectAll(".overview-row").data(replay_data["header"]["players"], function(d,i){return i;});

    rows.enter()
        .append("tr")
        .attr("class", "event-row")
        .each(function(d){createOverviewRow.call(this, d);});
}

function createOverviewRow(d)
{
    var row = d3.select(this);
    row.append("td")
        .text(d["name"]);
    row.append("td")
        .text(d["hero"]);
}

function updateOverview()
{
}



function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}