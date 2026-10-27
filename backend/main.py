from contextlib import asynccontextmanager
from fastapi import FastAPI
import asyncio
import random
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List


# 1. Initial match state
match = {
    "minute": 0,
    "home_team": "Barcelona FC",
    "away_team": "Real Madrid",
    "home_score": 0,
    "away_score": 0,
    "possession": "Real Madrid",
    "status": "LIVE",
    "events": [],
}

# Player lists for the simulation

players = {
    "Barcelona FC": [
        "Joan Garcia",
        "Xavi Espart",
        "Pau Cubarsi",
        "Gerard Martin",
        "Joao Cancelo",
        "Rodri",
        "Pedri",
        "Fermin Lopez",
        "Lamine Yamal",
        "Raphinha",
        "Anthony Gordon",
    ],

    "Real Madrid": [
        "Andriy Lunin",
        "Federico Valverde",
        "Ibrahima Konate",
        "Dean Huijsen",
        "Marc Cucurella",
        "Aurelien Tchouameni",
        "Bernardo Silva",
        "Arda Guler",
        "Jude Bellingham",
        "Yan Diomande",
        "Kylian Mbappe",
    ],
}


# 2. Event probabilities
event_types = [
    # Passing and possession
    "pass",
    "key_pass",
    "through_ball",
    "cross",
    "long_ball",
    "ball_recovery",
    "interception",
    "tackle",
    "dribble",
    "possession_change",
    # Attacking
    "shot",
    "shot_on_target",
    "shot_off_target",
    "blocked_shot",
    "goal",
    "own_goal",
    "header",
    "big_chance",
    "woodwork",
    # Set pieces
    "corner",
    "free_kick",
    "penalty",
    "throw_in",
    "goal_kick",
    "offside",
    # Fouls and discipline
    "foul",
    "yellow_card",
    "red_card",
    "handball",
    "penalty_awarded",
    "advantage_played",
    # Match interruptions
    "substitution",
    "injury",
    "player_return",
    "var_review",
    "var_decision",
    "kickoff",
    "half_time",
    "second_half_start",
    "full_time",
]


event_weights = [
    # Passing and possession (10)
    40,  # pass
    5,  # key_pass
    3,  # through_ball
    5,  # cross
    4,  # long_ball
    5,  # ball_recovery
    4,  # interception
    5,  # tackle
    5,  # dribble
    3,  # possession_change
    # Attacking (9)
    5,  # shot
    3,  # shot_on_target
    3,  # shot_off_target
    2,  # blocked_shot
    1,  # goal
    0.2,  # own_goal
    2,  # header
    1,  # big_chance
    0.5,  # woodwork
    # Set pieces (6)
    3,  # corner
    3,  # free_kick
    0.3,  # penalty
    4,  # throw_in
    3,  # goal_kick
    2,  # offside
    # Fouls and discipline (6)
    5,  # foul
    1,  # yellow_card
    0.1,  # red_card
    0.5,  # handball
    0.3,  # penalty_awarded
    0.5,  # advantage_played 
    # Match interruptions (8)
    0.5,  # substitution
    0.3,  # injury
    0.3,  # player_return
    0.2,  # var_review
    0.2,  # var_decision
    0,  # kickoff (triggered by match logic)
    0,  # half_time (triggered by match logic)
    0,  # second_half_start (triggered by match logic)
    0,  # full_time (triggered by match logic)
]


# ============LINEUPS==============

LINEUPS = {
    "Barcelona FC": {
        "formation": "4-3-3",

        "starting_xi": [
            {"name": "Joan Garcia", "position": "GK", "number": 1},
            {"name": "Joao Cancelo", "position": "LB", "number": 2},
            {"name": "Gerard Martin", "position": "CB", "number": 18},
            {"name": "Pau Cubarsi", "position": "CB", "number": 5},
            {"name": "Xavi Espart", "position": "RB", "number": 12},
            {"name": "Pedri", "position": "CM", "number": 8},
            {"name": "Rodri", "position": "CDM", "number": 16},
            {"name": "Fermin Lopez", "position": "CM", "number": 7},
            {"name": "Raphinha", "position": "LW", "number": 11},
            {"name": "Anthony Gordon", "position": "ST", "number": 17},
            {"name": "Lamine Yamal", "position": "RW", "number": 10},
        ],

        "substitutes": [
            {"name": "Wojciech Szczesny", "position": "GK", "number": 13},
            {"name": "Dominik Livakovic", "position": "GK", "number": 25},
            {"name": "Alejandro Balde", "position": "LB", "number": 3},
            {"name": "Gavi", "position": "CM", "number": 6},
            {"name": "Frenkie de Jong", "position": "CM", "number": 21},
            {"name": "Gabriel Jesus", "position": "ST", "number": 9},
            {"name": "Karim Adeyemi", "position": "FW", "number": 14},
            {"name": "Marc Bernal", "position": "CDM", "number": 22},
        ],
    },

    "Real Madrid": {
        "formation": "4-2-3-1",

        "starting_xi": [
            {"name": "Andriy Lunin", "position": "GK", "number": 13},
            {"name": "Marc Cucurella", "position": "LB", "number": 17},
            {"name": "Dean Huijsen", "position": "CB", "number": 4},
            {"name": "Ibrahima Konate", "position": "CB", "number": 16},
            {"name": "Federico Valverde", "position": "RB", "number": 8},
            {"name": "Aurelien Tchouameni", "position": "CDM", "number": 14},
            {"name": "Bernardo Silva", "position": "CM", "number": 20},
            {"name": "Yan Diomande", "position": "LW", "number": 25},
            {"name": "Jude Bellingham", "position": "CAM", "number": 5},
            {"name": "Arda Guler", "position": "RW", "number": 15},
            {"name": "Kylian Mbappe", "position": "ST", "number": 10},
        ],

        "substitutes": [
            {"name": "Sergio Mestre", "position": "GK", "number": 26},
            {"name": "Illia Voloshyn", "position": "GK", "number": 40},
            {"name": "Eder Militao", "position": "CB", "number": 3},
            {"name": "Eduardo Camavinga", "position": "CM", "number": 6},
            {"name": "Endrick", "position": "ST", "number": 9},
            {"name": "Trent Alexander-Arnold", "position": "RB", "number": 12},
            {"name": "Alvaro Carreras", "position": "LB", "number": 18},
            {"name": "Brahim Diaz", "position": "AM", "number": 21},
            {"name": "Antonio Rudiger", "position": "CB", "number": 22},
            {"name": "Thiago Pitarch", "position": "CM", "number": 27},
        ],
    },
}



def generate_penalty(team, player):
    event = {
        "minute": match["minute"],
        "team": team,
        "event": "penalty",
        "player": player,
        "is_important": True,
    }

    if random.random() < 0.76:
        event["event"] = "goal"
        event["outcome"] = "Penalty scored"
        event["is_penalty"] = True
        event["on_target"] = True

        if team == match["home_team"]:
            match["home_score"] += 1
        else:
            match["away_score"] += 1

    else:
        event["outcome"] = random.choice(
            ["Penalty saved", "Penalty missed", "Penalty hit the post"]
        )
        event["is_penalty"] = True
        event["on_target"] = event["outcome"] == "Penalty saved"

    match["events"].append(event)
    match["events"] = match["events"][-100:]

    return event


def add_match_event(team, event_type, player, **extra):
    event = {
        "minute": match["minute"],
        "team": team,
        "event": event_type,
        "player": player,
        **extra,
    }

    match["events"].append(event)
    match["events"] = match["events"][-100:]

    return event


def generate_set_piece(team, players):
    player = random.choice(players[team])

    situation = random.choices(
        ["corner", "free_kick", "penalty"], weights=[60, 38, 2], k=1
    )[0]

    if situation == "corner":
        return add_match_event(
            team,
            "corner",
            player,
            description=f"{team} win a corner!",
            is_important=True,
        )

    elif situation == "free_kick":
        return add_match_event(
            team,
            "free kick",
            player,
            description=f"Free kick awarded to {team}!",
            is_important=True,
        )

    else:
        return generate_penalty(team, player)


def generate_foul(team, player):
    # The attacking team receives the free kick.
    # The opposing team commits the foul.
    if random.random() < 0.08:
        return generate_penalty(team, player)

    event = {
        "minute": match["minute"],
        "team": team,
        "event": "free kick",
        "player": player,
        "reason": "Foul",
        "is_important": True,
        "description": f"Free kick awarded to {team}!",
    }

    match["events"].append(event)
    match["events"] = match["events"][-100:]

    return event


def generate_corner(team, players):
    player = random.choice(players[team])

    event = {
        "minute": match["minute"],
        "team": team,
        "event": "corner",
        "player": player,
        "is_important": True,
        "description": f"{team} win a corner!",
    }

    match["events"].append(event)
    match["events"] = match["events"][-100:]

    return event


# 3. Generate one football event


def generate_event():
    team = random.choice([
        match["home_team"],
        match["away_team"]
    ])

    # Use your existing global players dictionary
    player = random.choice(players[team])

    # Choose an event from your existing event list.
    # Ignore events with zero probability.
    available_events = [
        (event_type, weight)
        for event_type, weight in zip(event_types, event_weights)
        if weight > 0
    ]

    event_type = random.choices(
        [item[0] for item in available_events],
        weights=[item[1] for item in available_events],
        k=1
    )[0]

    # Generate an event using your existing helper functions
    if event_type == "penalty":
        return generate_penalty(team, player)

    elif event_type == "corner":
        return add_match_event(
            team,
            "corner",
            player,
            description=f"{team} win a corner!",
            is_important=True
        )

    elif event_type == "free_kick":
        return add_match_event(
            team,
            "free kick",
            player,
            description=f"Free kick awarded to {team}!",
            is_important=True
        )

    elif event_type == "foul":
        return generate_foul(team, player)

    elif event_type == "goal":
        event = add_match_event(
            team,
            "goal",
            player,
            is_important=True,
            description=f"GOAL! {player} scores for {team}!"
        )

        if team == match["home_team"]:
            match["home_score"] += 1
        else:
            match["away_score"] += 1

        return event

    elif event_type == "own_goal":
        opponent = (
            match["away_team"]
            if team == match["home_team"]
            else match["home_team"]
        )

        event = add_match_event(
            team,
            "own_goal",
            player,
            is_important=True,
            description=f"Own goal by {player}!"
        )

        if opponent == match["home_team"]:
            match["home_score"] += 1
        else:
            match["away_score"] += 1

        return event

    elif event_type == "shot_on_target":
        return add_match_event(
            team,
            "shot_on_target",
            player,
            on_target=True,
            is_important=True
        )

    elif event_type == "shot_off_target":
        return add_match_event(
            team,
            "shot_off_target",
            player,
            on_target=False
        )

    elif event_type == "yellow_card":
        return add_match_event(
            team,
            "yellow_card",
            player,
            card="yellow",
            is_important=True
        )

    elif event_type == "red_card":
        return add_match_event(
            team,
            "red_card",
            player,
            card="red",
            is_important=True
        )

    elif event_type == "substitution":
        substitutes = LINEUPS[team]["substitutes"]
        substitute = random.choice(substitutes)

        return add_match_event(
            team,
            "substitution",
            player,
            player_out=player,
            player_in=substitute["name"],
            is_important=True
        )

    # Handle all remaining event types
    extra = {}

    if event_type == "pass":
        extra["successful"] = random.random() < 0.75

    elif event_type == "key_pass":
        extra["successful"] = True
        extra["is_important"] = True
        extra["description"] = f"{player} creates a key pass!"

    elif event_type == "through_ball":
        extra["successful"] = random.random() < 0.65
        extra["description"] = f"{player} plays a through ball."

    elif event_type == "cross":
        extra["successful"] = random.random() < 0.65
        extra["description"] = f"{player} delivers a cross."

    elif event_type == "long_ball":
        extra["successful"] = random.random() < 0.70
        extra["description"] = f"{player} plays a long ball."

    elif event_type == "ball_recovery":
        extra["successful"] = True
        extra["description"] = f"{player} recovers the ball."

    elif event_type == "interception":
        extra["successful"] = True
        extra["description"] = f"{player} makes an interception."

    elif event_type == "tackle":
        extra["successful"] = random.choice([True, False])
        extra["is_important"] = extra["successful"]

    elif event_type == "dribble":
        extra["successful"] = random.random() < 0.60
        extra["description"] = f"{player} attempts a dribble."

    elif event_type == "possession_change":
        extra["description"] = f"{team} gain possession."

    elif event_type == "shot":
        extra["description"] = f"{player} attempts a shot."

    elif event_type == "shot_on_target":
        extra["on_target"] = True
        extra["is_important"] = True
        extra["description"] = f"{player} shoots on target."

    elif event_type == "shot_off_target":
        extra["on_target"] = False
        extra["description"] = f"{player} shoots off target."

    elif event_type == "blocked_shot":
        extra["on_target"] = False
        extra["description"] = f"{player}'s shot is blocked."

    elif event_type == "header":
        extra["description"] = f"{player} attempts a header."

    elif event_type == "big_chance":
        extra["is_important"] = True
        extra["description"] = f"Big chance for {team}!"

    elif event_type == "woodwork":
        extra["on_target"] = True
        extra["is_important"] = True
        extra["description"] = f"{player}'s shot hits the woodwork!"

    elif event_type == "throw_in":
        extra["description"] = f"Throw-in awarded to {team}."

    elif event_type == "goal_kick":
        extra["description"] = f"Goal kick for {team}."

    elif event_type == "offside":
        extra["description"] = f"{player} is caught offside."

    elif event_type == "handball":
        extra["is_important"] = True
        extra["description"] = f"Handball by {player}."

    elif event_type == "advantage_played":
        extra["description"] = f"Advantage played for {team}."

    elif event_type == "injury":
        extra["is_important"] = True
        extra["description"] = f"Play stopped due to an injury to {player}."

    elif event_type == "player_return":
        extra["description"] = f"{player} returns to the pitch."

    elif event_type == "var_review":
        extra["is_important"] = True
        extra["description"] = "VAR is reviewing a decision."

    elif event_type == "var_decision":
        extra["is_important"] = True
        extra["description"] = "VAR decision announced."

    return add_match_event(team, event_type, player, **extra)


 


def calculate_team_stats(team_name):

    events = [event for event in match["events"] if event["team"] == team_name]

    # Count different event types
    goals = sum(event["event"] == "goal" for event in events)

    shots = sum(event["event"] in ["shot", "goal"] for event in events)

    shots_on_target = sum(event.get("on_target", False) for event in events)

    passes = [event for event in events if event["event"] == "pass"]

    successful_passes = sum(event.get("successful", False) for event in passes)

    tackles = [event for event in events if event["event"] == "tackle"]

    successful_tackles = sum(event.get("successful", False) for event in tackles)

    interceptions = sum(event["event"] == "interception" for event in events)

    yellow_cards = sum(event["event"] == "yellow_card" for event in events)

    red_cards = sum(event["event"] == "red_card" for event in events)

    corners = sum(event["event"] == "corner" for event in events)

    free_kicks = sum(
        event["event"] in ["free_kick", "free kick"]
        for event in events
    )

    penalties = sum(
        event["event"] in ["penalty", "penalty_awarded"]
        for event in events
    )

    # Use the current possession team
    if match["possession"] == team_name:
        possession = 55
    else:
        possession = 45

    return {
        "team": team_name,
        "goals": goals,
        "shots": shots,
        "shots_on_target": shots_on_target,
        "passes": len(passes),
        "successful_passes": successful_passes,
        "passing_accuracy": (
            round(successful_passes / len(passes) * 100, 2) if passes else 0
        ),
        "tackles": len(tackles),
        "successful_tackles": successful_tackles,
        "interceptions": interceptions,
        "yellow_cards": yellow_cards,
        "red_cards": red_cards,
        "corners": corners,
        "free_kicks": free_kicks,
        "penalties": penalties,
        "possession": possession,
    }


def generate_tactical_insights():

    home = calculate_team_stats(match["home_team"])
    away = calculate_team_stats(match["away_team"])

    insights = []

    teams = [home, away]

    # 1. Attacking pressure
    if home["shots"] > away["shots"]:
        insights.append(
            {
                "type": "attacking_pressure",
                "team": home["team"],
                "message": (
                    f'{home["team"]} have attempted more shots '
                    f'than {away["team"]}, suggesting greater '
                    "attacking activity."
                ),
            }
        )

    elif away["shots"] > home["shots"]:
        insights.append(
            {
                "type": "attacking_pressure",
                "team": away["team"],
                "message": (
                    f'{away["team"]} have attempted more shots '
                    f'than {home["team"]}, suggesting greater '
                    "attacking activity."
                ),
            }
        )

    # 2. Defensive activity
    for team in teams:

        defensive_actions = team["successful_tackles"] + team["interceptions"]

        if defensive_actions >= 5:
            insights.append(
                {
                    "type": "defensive_activity",
                    "team": team["team"],
                    "message": (
                        f'{team["team"]} have recorded '
                        f"{defensive_actions} successful tackles "
                        "and interceptions combined."
                    ),
                }
            )

    # 3. Finishing efficiency
    for team in teams:

        if team["shots"] >= 3:

            conversion = (team["goals"] / team["shots"]) * 100

            if conversion >= 30:
                insights.append(
                    {
                        "type": "finishing_efficiency",
                        "team": team["team"],
                        "message": (
                            f'{team["team"]} have converted '
                            f"{conversion:.1f}% of their shots "
                            "into goals."
                        ),
                    }
                )

     # Shots on target comparison
    for team in teams:

        if team["shots"] >= 3:

            accuracy = (team["shots_on_target"] / team["shots"]) * 100

            insights.append(
                {
                    "type": "shooting_accuracy",
                    "team": team["team"],
                    "message": (
                        f'{team["team"]} have put '
                        f'{team["shots_on_target"]} out of '
                        f'{team["shots"]} shots on target '
                        f'({accuracy:.1f}%).'
                    ),
                }
            )


    # Defensive weakness: opponent creates too many shots
    if home["shots"] >= away["shots"] + 3:
        insights.append(
            {
                "type": "defensive_weakness",
                "team": away["team"],
                "message": (
                    f'{away["team"]} have allowed {home["shots"]} shots '
                    f'from {home["team"]}, compared with only '
                    f'{away["shots"]} shots by their own team. '
                    "Their defence may need to limit opposition shooting opportunities."
                ),
            }
        )

    elif away["shots"] >= home["shots"] + 3:
        insights.append(
            {
                "type": "defensive_weakness",
                "team": home["team"],
                "message": (
                    f'{home["team"]} have allowed {away["shots"]} shots '
                    f'from {away["team"]}, compared with only '
                    f'{home["shots"]} shots by their own team. '
                    "Their defence may need to limit opposition shooting opportunities."
                ),
            }
        )



    # 4. Passing accuracy comparison
    if home["passes"] >= 5 and away["passes"] >= 5:

        if home["passing_accuracy"] > away["passing_accuracy"]:
            insights.append(
                {
                    "type": "passing_accuracy",
                    "team": home["team"],
                    "message": (
                        f'{home["team"]} have a higher passing accuracy '
                        f'({home["passing_accuracy"]}%) than '
                        f'{away["team"]} ({away["passing_accuracy"]}%). '
                        "They are distributing the ball more accurately."
                    ),
                }
            )

        elif away["passing_accuracy"] > home["passing_accuracy"]:
            insights.append(
                {
                    "type": "passing_accuracy",
                    "team": away["team"],
                    "message": (
                        f'{away["team"]} have a higher passing accuracy '
                        f'({away["passing_accuracy"]}%) than '
                        f'{home["team"]} ({home["passing_accuracy"]}%). '
                        "They are distributing the ball more accurately."
                    ),
                }
            )

    
    # Passing dominance
    if home["successful_passes"] >= away["successful_passes"] + 10:
        insights.append(
            {
                "type": "passing_dominance",
                "team": home["team"],
                "message": (
                    f'{home["team"]} have completed '
                    f'{home["successful_passes"]} successful passes, '
                    f'compared with {away["successful_passes"]} by '
                    f'{away["team"]}. This suggests greater passing activity.'
                ),
            }
        )

    elif away["successful_passes"] >= home["successful_passes"] + 10:
        insights.append(
            {
                "type": "passing_dominance",
                "team": away["team"],
                "message": (
                    f'{away["team"]} have completed '
                    f'{away["successful_passes"]} successful passes, '
                    f'compared with {home["successful_passes"]} by '
                    f'{home["team"]}. This suggests greater passing activity.'
                ),
            }
        )


    # Set-piece threat: corner comparison
    if home["corners"] >= away["corners"] + 2:
        insights.append(
            {
                "type": "set_piece_threat",
                "team": home["team"],
                "message": (
                    f'{home["team"]} have won {home["corners"]} corners, '
                    f'compared with {away["corners"]} by {away["team"]}. '
                    "They are creating more opportunities from corners."
                ),
            }
        )

    elif away["corners"] >= home["corners"] + 2:
        insights.append(
            {
                "type": "set_piece_threat",
                "team": away["team"],
                "message": (
                    f'{away["team"]} have won {away["corners"]} corners, '
                    f'compared with {home["corners"]} by {home["team"]}. '
                    "They are creating more opportunities from corners."
                ),
            }
        )

        
    # Discipline risk
    for team in teams:

        if team["red_cards"] >= 1:
            insights.append(
                {
                    "type": "discipline_risk",
                    "team": team["team"],
                    "message": (
                        f'{team["team"]} have received a red card. '
                        "They must manage the match with fewer players."
                    ),
                }
            )

        elif team["yellow_cards"] >= 3:
            insights.append(
                {
                    "type": "discipline_risk",
                    "team": team["team"],
                    "message": (
                        f'{team["team"]} have received '
                        f'{team["yellow_cards"]} yellow cards. '
                        "Their players need to avoid further bookings."
                    ),
                }
            )

            
    # Comeback pressure
    if home["goals"] < away["goals"] and home["shots"] < away["shots"]:
        insights.append(
            {
                "type": "comeback_pressure",
                "team": home["team"],
                "message": (
                    f'{home["team"]} are trailing '
                    f'{home["goals"]}-{away["goals"]} and have attempted '
                    f'fewer shots ({home["shots"]}) than '
                    f'{away["team"]} ({away["shots"]}). '
                    "They may need to increase their attacking pressure."
                ),
            }
        )

    elif away["goals"] < home["goals"] and away["shots"] < home["shots"]:
        insights.append(
            {
                "type": "comeback_pressure",
                "team": away["team"],
                "message": (
                    f'{away["team"]} are trailing '
                    f'{away["goals"]}-{home["goals"]} and have attempted '
                    f'fewer shots ({away["shots"]}) than '
                    f'{home["team"]} ({home["shots"]}). '
                    "They may need to increase their attacking pressure."
                ),
            }
        )



    # Goalkeeper workload: shots on target conceded
    if home["shots_on_target"] >= away["shots_on_target"] + 2:
        insights.append(
            {
                "type": "goalkeeper_workload",
                "team": away["team"],
                "message": (
                    f'{away["team"]} are facing greater goalkeeper pressure: '
                    f'{home["shots_on_target"]} shots on target from '
                    f'{home["team"]}, compared with '
                    f'{away["shots_on_target"]} from their own attack. '
                    "Their goalkeeper is being tested more frequently."
                ),
            }
        )

    elif away["shots_on_target"] >= home["shots_on_target"] + 2:
        insights.append(
            {
                "type": "goalkeeper_workload",
                "team": home["team"],
                "message": (
                    f'{home["team"]} are facing greater goalkeeper pressure: '
                    f'{away["shots_on_target"]} shots on target from '
                    f'{away["team"]}, compared with '
                    f'{home["shots_on_target"]} from their own attack. '
                    "Their goalkeeper is being tested more frequently."
                ),
            }
        )







    # 5. Match score
    insights.append(
        {
            "type": "score_summary",
            "message": (
                f'{home["team"]} {home["goals"]} - ' f'{away["goals"]} {away["team"]}.'
            ),
        }
    )

    return insights


# ============ Pass accuracy =================
def calculate_pass_accuracy():
    total_passes = 0
    successful_passes = 0

    for event in match["events"]:
        if event["event"] == "pass":
            total_passes += 1

            if event.get("successful") is True:
                successful_passes += 1

    if total_passes == 0:
        return 0.0

    accuracy = (successful_passes / total_passes) * 100
    return round(accuracy, 2)


def calculate_team_pass_accuracy(team_name):
    total_passes = 0
    successful_passes = 0

    for event in match["events"]:
        if event["event"] == "pass" and event["team"] == team_name:
            total_passes += 1

            if event.get("successful") is True:
                successful_passes += 1

    if total_passes == 0:
        return 0.0

    accuracy = (successful_passes / total_passes) * 100

    return round(accuracy, 2)


# -========== Intelligence summary ===============-

def get_match_statistics():
    statistics = {}

    home_team = match["home_team"]
    away_team = match["away_team"]

    if match["possession"] == home_team:
        home_possession = 55
    else:
        home_possession = 45

    possession = {
        home_team: home_possession,
        away_team: 100 - home_possession,
    }

    for team in [match["home_team"], match["away_team"]]:
        total_passes = 0
        successful_passes = 0
        total_shots = 0
        total_goals = 0
        total_corners = 0
        total_red_cards = 0
        total_yellow_cards = 0
        total_free_kicks = 0
        total_penalties = 0

        for event in match["events"]:
            if event["team"] != team:
                continue

            event_type = str(event.get("event", "")).lower()

            if event_type == "pass":
                total_passes += 1

                if event.get("successful") is True:
                    successful_passes += 1

            elif event_type in ["shot", "shot_on_target", "shot_off_target"]:
                total_shots += 1

            elif event_type == "goal":
                total_goals += 1

            elif event_type == "corner":
                total_corners += 1

            elif event_type == "red_card":
                total_red_cards += 1

            elif event_type == "yellow_card":
                total_yellow_cards += 1

            elif event_type in ["free_kick", "free kick"]:
                total_free_kicks += 1

            elif event_type in ["penalty", "penalty_awarded"]:
                total_penalties += 1

        pass_accuracy = (
            round(successful_passes / total_passes * 100, 2)
            if total_passes > 0
            else 0.0
        )

        statistics[team] = {
            "possession": possession[team],
            "passes": total_passes,
            "successful_passes": successful_passes,
            "pass_accuracy": pass_accuracy,
            "shots": total_shots,
            "goals": total_goals,
            "corners": total_corners,
            "red_cards": total_red_cards,
            "yellow_cards": total_yellow_cards,
            "free_kicks": total_free_kicks,
            "penalties": total_penalties,
        }

    return statistics


# 4. Match Simulation Controls

simulation_running = False
simulation_speed = 1
simulation_task_interval = 5


async def run_match():
    global simulation_running

    while True:

        # Wait until the user presses Start
        if not simulation_running:
            await asyncio.sleep(0.2)
            continue

        # Stop simulation after the match finishes
        if match["minute"] >= 90:
            simulation_running = False
            match["status"] = "FINISHED"

            if not any(
                event.get("event") == "full_time"
                for event in match["events"]
            ):
                match["events"].append({
                    "minute": 90,
                    "team": "Match",
                    "event": "full_time",
                    "player": "Full-time",
                })

            continue

        # Wait according to the selected simulation speed
        await asyncio.sleep(
            simulation_task_interval / simulation_speed
        )

        # Check again in case the user paused during the wait
        if not simulation_running:
            continue

        # Advance the match by one minute
        match["minute"] += 1

        if match["minute"] == 45:

            match["events"].append({
                "minute": 45,
                "team": "Match",
                "event": "half_time",
                "player": "Half-time",
            })

            match["status"] = "HT"
            simulation_running = False

            continue

        # Generate your existing match events
        generate_event()

        # Automatically stop at full-time
        if match["minute"] >= 90:
            simulation_running = False
            match["status"] = "FINISHED"

            match["events"].append({
                "minute": 90,
                "team": "Match",
                "event": "full_time",
                "player": "Full-time",
            })


# 5. FastAPI lifespan

@asynccontextmanager
async def lifespan(app: FastAPI):

    task = asyncio.create_task(run_match())

    try:
        yield

    finally:
        task.cancel()

        try:
            await task

        except asyncio.CancelledError:
            pass


app = FastAPI(lifespan=lifespan)

class ChatRequest(BaseModel):
    question: str
    conversation_id: str = "default"

# Stores GOALKICK AI conversation history
chat_histories: Dict[str, List[dict]] = {}

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def get_home():
    return {"message": "Home page!"}



# 6. Match Control API
@app.post("/match/start")
def start_match():
    global simulation_running

    if match["minute"] >= 90:
        return {
            "success": False,
            "message": "Match finished. Reset the match first.",
            "status": match["status"],
        }

    simulation_running = True
    match["status"] = "LIVE"

    return {
        "success": True,
        "message": "Match started!",
        "status": match["status"],
        "minute": match["minute"],
    }


@app.post("/match/pause")
def pause_match():
    global simulation_running

    simulation_running = False

    if match["minute"] >= 90:
        match["status"] = "FINISHED"
    elif match["minute"] >= 45:
        match["status"] = "HT"
    else:
        match["status"] = "PAUSED"

    return {
        "success": True,
        "message": "Match paused!",
        "status": match["status"],
        "minute": match["minute"],
    }


@app.post("/match/reset")
def reset_match():
    global simulation_running, simulation_speed

    simulation_running = False
    simulation_speed = 1

    match["minute"] = 0
    match["home_score"] = 0
    match["away_score"] = 0
    match["possession"] = "Real Madrid"
    match["status"] = "READY"
    match["events"].clear()

    return {
        "success": True,
        "message": "Match reset successfully!",
        "status": match["status"],
        "minute": match["minute"],
        "home_score": match["home_score"],
        "away_score": match["away_score"],
        "speed": simulation_speed,
    }


@app.post("/match/speed-up")
def speed_up_match():
    global simulation_speed

    # Cycle through 1x, 2x and 4x speed
    if simulation_speed == 1:
        simulation_speed = 2
    elif simulation_speed == 2:
        simulation_speed = 4
    else:
        simulation_speed = 1

    return {
        "success": True,
        "message": "Simulation speed updated!",
        "speed": simulation_speed,
    }



# 6. Get current match information
@app.get("/match")
def get_match():
    return {key: value for key, value in match.items() if key != "events"}


@app.get("/statistics")
def get_statistics():
    return get_match_statistics()


@app.get("/stats")
def get_stats():
    stats = {}

    for team in [match["home_team"], match["away_team"]]:
        total_passes = 0
        successful_passes = 0
        total_shots = 0
        total_goals = 0

        for event in match["events"]:
            if event["team"] == team:

                if event["event"] == "pass":
                    total_passes += 1

                    if event.get("successful") is True:
                        successful_passes += 1

                elif event["event"] == "shot":
                    total_shots += 1

                elif event["event"] == "goal":
                    total_goals += 1

        pass_accuracy = (
            round(successful_passes / total_passes * 100, 2)
            if total_passes > 0
            else 0.0
        )

        stats[team] = {
            "passes": total_passes,
            "successful_passes": successful_passes,
            "pass_accuracy": pass_accuracy,
            "shots": total_shots,
            "goals": total_goals,
        }

    return stats


@app.get("/summary")
def get_summary():
    stats = get_stats()

    home = match["home_team"]
    away = match["away_team"]

    home_score = match["home_score"]
    away_score = match["away_score"]

    home_stats = stats[home]
    away_stats = stats[away]

    if home_score > away_score:
        result = f"{home} lead {away}."
    elif away_score > home_score:
        result = f"{away} lead {home}."
    else:
        result = f"{home} and {away} are level."

    if home_stats["successful_passes"] > away_stats["successful_passes"]:
        passing = f"{home} have completed more passes."
    elif away_stats["successful_passes"] > home_stats["successful_passes"]:
        passing = f"{away} have completed more passes."
    else:
        passing = "Both teams have completed the same number of passes."

    return {
        "minute": match["minute"],
        "score": f"{home_score}-{away_score}",
        "summary": f"{result} {passing}",
        "data_type": "synthetic",
    }


@app.get("/events")
def get_events():
    return match["events"]


@app.get("/lineups")
def get_lineups():
    return LINEUPS


@app.get("/lineups/{team_name}")
def get_team_lineup(team_name: str):
    lineup = LINEUPS.get(team_name)

    if lineup is None:
        return {"error": "Team lineup not found"}

    return {"team": team_name, **lineup}


@app.get("/match/stats")
def get_match_stats():
    return {
        "home": calculate_team_stats(match["home_team"]),
        "away": calculate_team_stats(match["away_team"]),
    }


@app.get("/match/insights")
def get_match_insights():
    return {"match": match, "insights": generate_tactical_insights()}


@app.post("/api/chat")

def chat_with_football_ai(request: ChatRequest):
    question = request.question.strip().lower()

    if not question:
        return {"answer": "Please enter a football question."}

    home = match["home_team"]
    away = match["away_team"]

    home_stats = calculate_team_stats(home)
    away_stats = calculate_team_stats(away)

    home_score = match["home_score"]
    away_score = match["away_score"]
    minute = match["minute"]

    # 1. Current match score
    if any(word in question for word in ["score", "result", "goals"]):
        answer = (
            f"Current match: {home} {home_score} - "
            f"{away_score} {away}.\n"
            f"Match minute: {minute}."
        )

    # 2. Current match analysis
    elif any(word in question for word in ["analyze", "analysis", "match"]):
        answer = (
            f"⚽ Match Analysis — {home} vs {away}\n\n"
            f"Score: {home_score}-{away_score}\n"
            f"Minute: {minute}\n\n"
            f"{home}: {home_stats['shots']} shots, "
            f"{home_stats['shots_on_target']} on target, "
            f"{home_stats['possession']}% possession.\n\n"
            f"{away}: {away_stats['shots']} shots, "
            f"{away_stats['shots_on_target']} on target, "
            f"{away_stats['possession']}% possession."
        )

    # 3. Team comparison
    elif any(
        word in question
        for word in ["compare", "comparison", "dominating", "better"]
    ):
        answer = (
            f"📊 Team Comparison\n\n"
            f"{home}: {home_stats['shots']} shots, "
            f"{home_stats['passing_accuracy']}% passing accuracy.\n\n"
            f"{away}: {away_stats['shots']} shots, "
            f"{away_stats['passing_accuracy']}% passing accuracy.\n\n"
            f"Possession currently favors {match['possession']}."
        )

    # 4. Tactical insights
    elif any(
        word in question
        for word in ["tactical", "tactics", "insights", "strategy"]
    ):
        insights = generate_tactical_insights()

        if insights:
            answer = (
                "🧠 Tactical Insights\n\n"
                + "\n\n".join(
                    insight["message"] for insight in insights
                )
            )
        else:
            answer = (
                "There are not enough match events for meaningful "
                "tactical insights yet. Try again as the match progresses."
            )

    # 5. Possession
    elif "possession" in question:
        answer = (
            f"{match['possession']} currently has the simulated "
            f"possession advantage:\n"
            f"{home}: {home_stats['possession']}% possession.\n"
            f"{away}: {away_stats['possession']}% possession."
        )

    # 6. Shots
    elif "shot" in question:
        answer = (
            f"⚽ Shot Statistics\n\n"
            f"{home}: {home_stats['shots']} shots, "
            f"{home_stats['shots_on_target']} on target.\n\n"
            f"{away}: {away_stats['shots']} shots, "
            f"{away_stats['shots_on_target']} on target."
        )

    # 7. Passing
    elif any(word in question for word in ["pass", "passing"]):
        answer = (
            f"📊 Passing Statistics\n\n"
            f"{home}: {home_stats['passes']} passes, "
            f"{home_stats['passing_accuracy']}% passing accuracy.\n\n"
            f"{away}: {away_stats['passes']} passes, "
            f"{away_stats['passing_accuracy']}% passing accuracy."
        )

    # 8. Football rules
    elif "offside" in question:
        answer = (
            "⚽ Offside Rule\n\n"
            "Offside occurs when an attacking player is in the opponent's "
            "half and nearer to the goal line than both the ball and the "
            "second-last opponent when a teammate plays the ball to them, "
            "and they become involved in active play. Being in an offside "
            "position alone is not an offence."
        )

    elif any(word in question for word in ["rules", "football rules"]):
        answer = (
            "⚽ Basic Football Rules\n\n"
            "Football is played by two teams of 11 players. The objective "
            "is to score more goals than the opponent. Important rules "
            "include fouls, offside, throw-ins, corners, goal kicks, "
            "penalties and disciplinary cards."
        )

    # 9. Follow-up questions about a team
    elif any(
        word in question
        for word in ["what about", "how about", "tell me about"]
    ):
        if "real madrid" in question or "madrid" in question:
            team_name = away
            team_stats = away_stats

        elif "barcelona" in question:
            team_name = home
            team_stats = home_stats

        else:
            team_name = None
            team_stats = None

        if team_name:
            answer = (
                f"⚽ {team_name} — Current Match Performance\n\n"
                f"Score: {home_score}-{away_score}\n"
                f"Match minute: {minute}\n"
                f"Home team Shots: {home_stats['shots']}\n"
                f"Away team Shots: {away_stats['shots']}\n"
                f"Home team Shots on target: {home_stats['shots_on_target']}\n"
                f"Away team Shots on target: {away_stats['shots_on_target']}\n"
                f"Home team Possession: {home_stats['possession']}%\n"
                f"Away team Possession: {away_stats['possession']}%\n"
                f"Home team Passing accuracy: {home_stats['passing_accuracy']}%"
                f"Away team Passing accuracy: {away_stats['passing_accuracy']}%"
            )
        else:
            answer = (
                f"Which team would you like to know about: "
                f"{home} or {away}?"
            )

    # 10. Unknown questions — keep this as the final else
    else:
        answer = (
            "I can help with the current match score, match analysis, "
            "team comparisons, possession, shots, passing, tactical "
            "insights and basic football rules.\n\n"
            "Try asking: 'What is the current score?', "
            "'Analyze the match', 'Compare both teams', "
            "'Show tactical insights', or 'What about Real Madrid?'"
        )

    # Save conversation history if configured
    conversation_id = request.conversation_id
    history = chat_histories.setdefault(conversation_id, [])

    history.append({
        "role": "user",
        "content": request.question
    })

    history.append({
        "role": "assistant",
        "content": answer
    })

    return {
        "answer": answer,
        "minute": minute,
        "data_type": "simulated_match",
        "conversation_id": conversation_id,
        "history": history
    }

