var current_tutorial_step = 0;
var tutorial_data = [];
var tutorial_shown = false;

function init_tutorial(tutorial)
{
    tutorial_data = tutorial;

    if(tutorial_data.length < 1)
    {
        console.log("bad tutorial", tutorial_data);
        return;
    }

    d3.select("#tutorial-overlay").style('height', $(document).height()+"px");
    d3.select("#tutorial-overlay").classed("tutorial-overlay-activated", true);

    d3.select("#close-tutorial").on("click",
        function()
        {
            close_tutorial();
        }
    );

    current_tutorial_step = 0;
    tutorial_shown = true;
    showTutorialStep(current_tutorial_step);
}

function showTutorialStep(step)
{
    if(step >= tutorial_data.length)
    {
        close_tutorial();
    }

    var step_data = tutorial_data[step];

    d3.selectAll(".tutorial-highlight").classed("tutorial-highlight", false);
    d3.selectAll(".tooltip-shown").classed("tooltip-shown", false);

    d3.select(step_data["highlight-selector"]).classed("tutorial-highlight", true);
    d3.select(step_data["tooltip-selector"]).classed("tooltip-shown", true);


    updateTooltipPosition();    


    d3.select(step_data["tooltip-selector"]+" .tutorial-next").on("click",
        function()
        {
            current_tutorial_step += 1;
            if(current_tutorial_step == tutorial_data.length)
            {
                close_tutorial();
            }
            else
            {
                showTutorialStep(current_tutorial_step);
            }
        })
}

function close_tutorial()
{
    tutorial_shown = false;
    d3.select("#tutorial-overlay").classed("tutorial-overlay-activated", false)
}

$(window).on('resize',
    function()
    {
        d3.select("#tutorial-overlay").style('height', $(document).height()+"px");

        if(tutorial_shown)
        {
            updateTooltipPosition();
        }
    }
);

function updateTooltipPosition()
{
    var step_data = tutorial_data[current_tutorial_step];
    
    var centered_left  = d3.select("body").node().scrollLeft
                        + d3.select(step_data["highlight-selector"]).node().getBoundingClientRect().left 
                        + d3.select(step_data["highlight-selector"]).node().getBoundingClientRect().width /2
                        - d3.select(step_data["tooltip-selector"]).node().getBoundingClientRect().width /2;

    d3.select(step_data["tooltip-selector"]).classed("notransition", true);
    d3.select(step_data["tooltip-selector"]).style("left", centered_left+"px");

    switch(step_data["position"])
    {
        case "above":
            var computed_top = d3.select("body").node().scrollTop
                                + d3.select(step_data["highlight-selector"]).node().getBoundingClientRect().top 
                                - d3.select(step_data["tooltip-selector"]).node().getBoundingClientRect().height
                                - 20;//thats the  arrow
            d3.select(step_data["tooltip-selector"]).style("top", computed_top+"px");
            break;
        case "below":
            var computed_top = d3.select("body").node().scrollTop
                                + d3.select(step_data["highlight-selector"]).node().getBoundingClientRect().bottom
                                + 20;//thats the  arrow
            d3.select(step_data["tooltip-selector"]).style("top", computed_top+"px");
            break;
    }
    //d3.select(step_data["tooltip-selector"]).classed("notransition", false);
}