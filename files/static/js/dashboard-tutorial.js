$(function(){


	$(document).ready(function(){

		$("#tutorial-overlay").css({
			'height':$('body').height()+"px",
		});

		setTimeout(init_tutorial,500);

		$(document).on('click','#close-tutorial',close_tutorial);

	});

	$(window).on('resize',function(){

		$("#tutorial-overlay").css({
			'height':$('body').height()+"px",
		});

		


		$("#tutorial-overlay .playercard").css({
			'left': $(".top-dashboard .playercard").offset().left + "px",
			'top': $(".top-dashboard .playercard").offset().top + "px"
		});

		


		$("#tutorial-overlay #matches-graph-container").css({
			'left': ($(".top-dashboard #matches-graph-container").offset().left+15) + "px",
			'top': $(".top-dashboard #matches-graph-container").offset().top + "px",
			'width': $(".top-dashboard #matches-graph-container").width() + "px",
			'height': $(".top-dashboard #matches-graph-container").height() + "px",
		});

		$("#tutorial-tooltip-matches").addClass('notransition');
		$("#tutorial-tooltip-matches").css({
			'left': $("#tutorial-overlay #matches-graph-container").width()/2 + "px",
			'margin-left': "-" + $("#tutorial-tooltip-matches").width()/2 + "px"
		});
		$("#tutorial-tooltip-matches")[0].offsetHeight; // trigger reflow
		$("#tutorial-tooltip-matches").removeClass('notransition');



	
		$("#tutorial-overlay .match-stats").css({
			'left': $("body > .match-stats").offset().left + "px",
			'top': ($("body > .match-stats").offset().top-20)+ "px",
			'width': $("body > .match-stats").width() + "px",
			'height': $("body > .match-stats").height() + "px",
		});

		$("#tutorial-tooltip-skills").addClass('notransition');
		$("#tutorial-tooltip-skills").css({
			'left': $("#tutorial-overlay .match-stats").width()/2 + "px",
			'bottom': ($("#tutorial-overlay .match-stats").height()-15+62) + "px",
			'margin-left': "-" + $("#tutorial-tooltip-skills").width()/2 + "px",
		});
		$("#tutorial-tooltip-skills")[0].offsetHeight; // trigger reflow
		$("#tutorial-tooltip-skills").removeClass('notransition');

	});

	function init_tutorial()
	{
		$("#tutorial-overlay").css({
			'z-index':'100',
			'opacity':1
		});

		tutorial_playercard();
	}

	function tutorial_playercard()
	{
		var $playercard = $(".playercard").clone();
		
		$playercard.css({
			'display': 'none',
			'position':'absolute',
			'left': $(".playercard").offset().left + "px",
			'top': $(".playercard").offset().top + "px"
		});

		$playercard.appendTo("#tutorial-overlay");

		$("#tutorial-tooltip-playercard").addClass('notransition').appendTo($playercard);
		$("#tutorial-tooltip-playercard")[0].offsetHeight; // trigger reflow
		$("#tutorial-tooltip-playercard").removeClass('notransition');

		$playercard.fadeIn(300);

		$("#tutorial-tooltip-playercard").css({
			'margin-top': '42px'
		}).addClass('tooltip-shown');

		$("#tutorial-tooltip-playercard").on('click','.tutorial-next',function(){

			$("#tutorial-tooltip-playercard").removeClass('tooltip-shown')
				.css('margin-top','-20px');
			
			$playercard.fadeOut(300);

			setTimeout(tutorial_matches_graph,300);

		});
	}

	function tutorial_matches_graph()
	{
		var $matches_graph = $("#matches-graph-container").clone();
		
		$matches_graph.css({
			'display': 'none',
			'position':'absolute',
			'left': ($("#matches-graph-container").offset().left+15) + "px",
			'top': $("#matches-graph-container").offset().top + "px",
			'width': $("#matches-graph-container").width() + "px",
			'height': $("#matches-graph-container").height() + "px",
			'padding': 0
		});

		$matches_graph.appendTo("#tutorial-overlay");

		$("#tutorial-tooltip-matches").addClass('notransition').appendTo($matches_graph);
		$("#tutorial-tooltip-matches").css({
			'left': $matches_graph.width()/2 + "px",
			'margin-left': "-" + $("#tutorial-tooltip-matches").width()/2 + "px"
		});
		$("#tutorial-tooltip-matches")[0].offsetHeight; // trigger reflow
		$("#tutorial-tooltip-matches").removeClass('notransition');

		$matches_graph.fadeIn(300);

		$("#tutorial-tooltip-matches").css({
			'margin-top': '42px'
		}).addClass('tooltip-shown');

		$("#tutorial-tooltip-matches").on('click','.tutorial-next',function(){

			$("#tutorial-tooltip-matches").removeClass('tooltip-shown')
				.css('margin-top','-20px');

			$matches_graph.fadeOut(300);
			setTimeout(tutorial_skills,300);

		});
	}

	function tutorial_skills()
	{
		var $match_stats = $(".match-stats").clone();
		
		$match_stats.css({
			'display': 'none',
			'position':'absolute',
			'left': $(".match-stats").offset().left + "px",
			'top': ($(".match-stats").offset().top-20) + "px",
			'width': $(".match-stats").width() + "px",
			'height': $(".match-stats").height() + "px",
			'padding': 0
		});

		$match_stats.appendTo("#tutorial-overlay");

		$("#tutorial-tooltip-skills").addClass('notransition').appendTo($match_stats);
		$("#tutorial-tooltip-skills").css({
			'left': $match_stats.width()/2 + "px",
			'bottom': ($match_stats.height()-15) + "px",
			'margin-left': "-" + $("#tutorial-tooltip-skills").width()/2 + "px",
			'margin-top':'20px'
		});
		$("#tutorial-tooltip-skills")[0].offsetHeight; // trigger reflow
		$("#tutorial-tooltip-skills").removeClass('notransition');

		$match_stats.fadeIn(300);

		$("#tutorial-tooltip-skills").css({
			'bottom': '+=62'
		}).addClass('tooltip-shown');

		$("#tutorial-tooltip-skills").on('click','.tutorial-close',function(){

			$("#tutorial-tooltip-skills").removeClass('tooltip-shown')
				.css('margin-top','-20px');

			$match_stats.fadeOut(300);

			setTimeout(close_tutorial,300);

		});
	}

	function close_tutorial()
	{
		$("#tutorial-overlay").css('opacity',0);

		setTimeout(function(){
			$("#tutorial-overlay").css('z-index','-1');

			if($("#tutorial-overlay .playercard").length != 0)
				$("#tutorial-overlay .playercard").remove();

			if($("#tutorial-overlay #matches-graph-container").length != 0)
				$("#tutorial-overlay #matches-graph-container").remove();

			if($("#tutorial-overlay .match-stats").length != 0)
				$("#tutorial-overlay .match-stats").remove();

		},300);
	}

});