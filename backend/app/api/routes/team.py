from fastapi import APIRouter, HTTPException
from datetime import datetime
from bson import ObjectId

# from app.db.mongodb import db
from app.core.database import db, teams_collection
from app.schemas.team import TeamCreate

router = APIRouter(
    prefix="/teams",
    tags=["Teams"]
)

team_collection = teams_collection if teams_collection is not None else (db["teams"] if db is not None else None)


def get_team_collection():
    if team_collection is None:
        raise HTTPException(
            status_code=503,
            detail="Database offline"
        )

    return team_collection

@router.post("/")
async def create_team(team: TeamCreate):
    try:
        collection = get_team_collection()
        team_data = {
            "team_name": team.team_name,
            "department": team.department,
            "team_leader": team.team_leader,
            "team_description": team.team_description,
            "members": team.members,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        result = collection.insert_one(team_data)

        # Return the complete created team with all fields
        return {
            "success": True,
            "message": "Team created successfully",
            "team_id": str(result.inserted_id),
            "data": {
                "_id": str(result.inserted_id),
                "team_name": team_data["team_name"],
                "department": team_data["department"],
                "team_leader": team_data["team_leader"],
                "team_description": team_data["team_description"],
                "members": team_data["members"],
                "created_at": team_data["created_at"],
                "updated_at": team_data["updated_at"],
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create team: {str(e)}"
        )


@router.get("/")
async def get_all_teams():
    try:
        collection = get_team_collection()
        teams = []

        for team in collection.find():
            team["_id"] = str(team["_id"])
            teams.append(team)

        return {
            "success": True,
            "teams": teams,
            "count": len(teams)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch teams: {str(e)}"
        )


@router.get("/{team_id}")
async def get_team(team_id: str):

    collection = get_team_collection()

    team = collection.find_one(
        {"_id": ObjectId(team_id)}
    )

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    team["_id"] = str(team["_id"])

    return team


@router.put("/{team_id}")
async def update_team(
    team_id: str,
    team: TeamCreate
):

    collection = get_team_collection()

    result = collection.update_one(
        {"_id": ObjectId(team_id)},
        {
            "$set": {
                "team_name": team.team_name,
                "department": team.department,
                "team_leader": team.team_leader,
                "team_description": team.team_description,
                "members": team.members,
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    return {
        "success": True,
        "message": "Team updated successfully",
    }


@router.delete("/{team_id}")
async def delete_team(team_id: str):

    collection = get_team_collection()

    result = collection.delete_one(
        {"_id": ObjectId(team_id)}
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    return {
        "success": True,
        "message": "Team deleted successfully",
    }
