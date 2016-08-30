var  dashboard_tutorial = 
[
    {
        "highlight-selector": ".playercard",
        "tooltip-selector": "#tutorial-tooltip-playercard",
        "position": "below"
    },
    {
        "highlight-selector": "#matches-graph-container",
        "tooltip-selector": "#tutorial-tooltip-matches",
        "position": "below"
    },
    {
        "highlight-selector": ".match-stats",
        "tooltip-selector": "#tutorial-tooltip-skills",
        "position": "above"
    },
];


$(document).ready(function(){

    if(play_tutorial)
    {
        setTimeout(
            function()
            {
                init_tutorial(dashboard_tutorial);
            }
            ,500);
    }

    d3.select("#close-tutorial").on("click",
        function()
        {
            close_tutorial();
        }
    );
});