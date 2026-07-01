from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.database import employee_activity_collection
from app.schemas.productivity import EmployeeActivity, ProductivityPredictionResponse

router = APIRouter(tags=["productivity"])


def calculate_productivity_score(record: dict) -> float:
    tasks_assigned = record.get("tasks_assigned", 0)
    tasks_completed = record.get("tasks_completed", 0)
    idle_minutes = record.get("idle_minutes", 0)
    overtime_minutes = record.get("overtime_minutes", 0)

    tasks_score = (tasks_completed / tasks_assigned) * 100 if tasks_assigned > 0 else 0
    return round(tasks_score - (idle_minutes * 0.5) + (overtime_minutes * 0.2), 2)


def _parse_iso_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(str(value)[:10])
        except ValueError:
            return None


def _record_activity_date(record: dict) -> Optional[date]:
    for key in ("activity_date", "date", "created_at", "createdAt", "logged_at", "loggedAt"):
        parsed = _parse_iso_date(record.get(key))
        if parsed:
            return parsed
    return None


def _require_manager_access(authorization: Optional[str], x_user_role: Optional[str]) -> None:
    role = (x_user_role or "").strip().lower()
    if authorization and authorization.lower().startswith("bearer "):
        # Existing lightweight manager pages pass X-User-Role. Full JWT role parsing is
        # handled in auth-heavy routes; this endpoint keeps the same header contract.
        role = role or ""
    if role not in {"manager", "hr", "admin"}:
        raise HTTPException(status_code=403, detail="Manager access required")


def _activity_status(score: float) -> str:
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Average"
    return "Needs Attention"


def _clamp_percent(value: float) -> int:
    return max(0, min(100, round(value)))


def _risk_level(value: int) -> str:
    if value >= 70:
        return "High"
    if value >= 40:
        return "Medium"
    return "Low"


def _build_productivity_payload(start: date, end: date, employee_id: Optional[str] = None, team_name: Optional[str] = None) -> dict:
    docs = list(employee_activity_collection.find({}, {"_id": 0}))
    members_by_id: dict[str, dict] = {}
    teams = set()
    entries = []

    for record in docs:
        record_employee_id = str(record.get("employee_id", ""))
        employee_name = record.get("employee_name") or record_employee_id or "Employee"
        record_team = record.get("team_name") or "Individual"
        if record_employee_id:
            members_by_id[record_employee_id] = {"id": record_employee_id, "name": employee_name}
        teams.add(record_team)

        activity_date = _record_activity_date(record)
        if activity_date and not (start <= activity_date <= end):
            continue
        if not activity_date:
            continue
        if employee_id and record_employee_id != str(employee_id):
            continue
        if team_name and record_team != team_name:
            continue

        score = calculate_productivity_score(record)
        entries.append(
            {
                "employee_id": record_employee_id,
                "employee_name": employee_name,
                "team_name": record_team,
                "activity_date": activity_date.isoformat(),
                "tasks_assigned": int(record.get("tasks_assigned", 0) or 0),
                "tasks_completed": int(record.get("tasks_completed", 0) or 0),
                "idle_minutes": int(record.get("idle_minutes", 0) or 0),
                "overtime_minutes": int(record.get("overtime_minutes", 0) or 0),
                "productivity_score": score,
                "status": _activity_status(score),
            }
        )

    total_tasks_assigned = sum(item["tasks_assigned"] for item in entries)
    total_tasks_completed = sum(item["tasks_completed"] for item in entries)
    total_idle_minutes = sum(item["idle_minutes"] for item in entries)
    total_overtime_minutes = sum(item["overtime_minutes"] for item in entries)
    avg_productivity = round(sum(item["productivity_score"] for item in entries) / len(entries), 2) if entries else 0
    completion_rate = round((total_tasks_completed / total_tasks_assigned) * 100, 2) if total_tasks_assigned else 0

    entries.sort(key=lambda item: (item["activity_date"], item["employee_name"]), reverse=True)
    members = sorted(members_by_id.values(), key=lambda member: member["name"].lower())

    return {
        "filters": {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "employee_id": employee_id,
            "team_name": team_name,
        },
        "members": members,
        "teams": sorted(teams, key=str.lower),
        "summary": {
            "total_entries": len(entries),
            "total_members": len({item["employee_id"] for item in entries if item["employee_id"]}),
            "avg_productivity": avg_productivity,
            "completion_rate": completion_rate,
            "total_tasks_assigned": total_tasks_assigned,
            "total_tasks_completed": total_tasks_completed,
            "total_idle_minutes": total_idle_minutes,
            "total_overtime_minutes": total_overtime_minutes,
        },
        "entries": entries,
    }


def _predict_employee(entries: list[dict]) -> dict:
    total_entries = len(entries)
    total_assigned = sum(item["tasks_assigned"] for item in entries)
    total_completed = sum(item["tasks_completed"] for item in entries)
    total_idle = sum(item["idle_minutes"] for item in entries)
    total_overtime = sum(item["overtime_minutes"] for item in entries)
    avg_score = sum(item["productivity_score"] for item in entries) / total_entries if total_entries else 0
    completion_rate = (total_completed / total_assigned) * 100 if total_assigned else 0
    avg_idle = total_idle / total_entries if total_entries else 0
    avg_overtime = total_overtime / total_entries if total_entries else 0

    ordered = sorted(entries, key=lambda item: item["activity_date"])
    midpoint = max(1, len(ordered) // 2)
    first_half = ordered[:midpoint]
    second_half = ordered[midpoint:] or ordered[-midpoint:]
    first_avg = sum(item["productivity_score"] for item in first_half) / len(first_half) if first_half else avg_score
    second_avg = sum(item["productivity_score"] for item in second_half) / len(second_half) if second_half else avg_score
    score_drop = max(0, first_avg - second_avg)

    low_productivity_pressure = max(0, 75 - avg_score)
    completion_gap = max(0, 85 - completion_rate)
    burnout_risk = _clamp_percent((avg_overtime * 1.25) + (avg_idle * 0.45) + (low_productivity_pressure * 0.45))
    performance_drop = _clamp_percent((score_drop * 1.4) + (completion_gap * 0.45) + (avg_idle * 0.25))
    resignation_probability = _clamp_percent((burnout_risk * 0.35) + (performance_drop * 0.35) + (low_productivity_pressure * 0.45) + (completion_gap * 0.25))

    return {
        "employee_id": entries[0]["employee_id"],
        "employee_name": entries[0]["employee_name"],
        "team_name": entries[0]["team_name"],
        "burnout_risk": burnout_risk,
        "burnout_level": _risk_level(burnout_risk),
        "resignation_probability": resignation_probability,
        "resignation_level": _risk_level(resignation_probability),
        "performance_drop": performance_drop,
        "performance_drop_level": _risk_level(performance_drop),
    }


@router.post("/activity/log")
def add_employee_activity(activity: EmployeeActivity):
    if employee_activity_collection is None:
        return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

    payload = activity.model_dump()
    if not payload.get("activity_date"):
        payload["activity_date"] = date.today().isoformat()
    employee_activity_collection.insert_one(payload)

    return {
        "message": "Employee activity recorded",
        "employee_productivity_score": calculate_productivity_score(payload),
    }


@router.get("/manager/productivity")
def get_manager_productivity(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    employee_id: Optional[str] = Query(default=None, description="Optional employee id filter"),
    team_name: Optional[str] = Query(default=None, description="Optional team name filter"),
    authorization: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _require_manager_access(authorization, x_user_role)

    if employee_activity_collection is None:
        return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

    start = _parse_iso_date(start_date)
    end = _parse_iso_date(end_date)
    if not start or not end:
        raise HTTPException(status_code=400, detail="start_date and end_date must be valid YYYY-MM-DD dates")
    if start > end:
        raise HTTPException(status_code=400, detail="start_date cannot be after end_date")

    return _build_productivity_payload(start, end, employee_id, team_name)


@router.get("/manager/productivity/predictions", response_model=ProductivityPredictionResponse)
def get_manager_productivity_predictions(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    employee_id: Optional[str] = Query(default=None, description="Optional employee id filter"),
    team_name: Optional[str] = Query(default=None, description="Optional team name filter"),
    authorization: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    _require_manager_access(authorization, x_user_role)

    if employee_activity_collection is None:
        return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

    start = _parse_iso_date(start_date)
    end = _parse_iso_date(end_date)
    if not start or not end:
        raise HTTPException(status_code=400, detail="start_date and end_date must be valid YYYY-MM-DD dates")
    if start > end:
        raise HTTPException(status_code=400, detail="start_date cannot be after end_date")

    payload = _build_productivity_payload(start, end, employee_id, team_name)
    grouped_entries: dict[str, list[dict]] = {}
    for entry in payload["entries"]:
        grouped_entries.setdefault(entry["employee_id"], []).append(entry)

    predictions = [_predict_employee(entries) for entries in grouped_entries.values() if entries]
    predictions.sort(key=lambda item: item["employee_name"].lower())

    return {
        "filters": payload["filters"],
        "predictions": predictions,
    }


@router.get("/employee/productivity")
def get_employee_productivity():
    if employee_activity_collection is None:
        return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

    result = []
    for record in employee_activity_collection.find({}, {"_id": 0}):
        result.append(
            {
                "employee_id": record["employee_id"],
                "employee_name": record["employee_name"],
                "team_name": record.get("team_name"),
                "productivity_score": calculate_productivity_score(record),
            }
        )

    return result


@router.get("/team/weekly_score")
def weekly_score():
    if employee_activity_collection is None:
        return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

    records = list(employee_activity_collection.find({}, {"_id": 0}))
    if not records:
        return {"message": "No employee records found."}

    team_summary = {}
    for record in records:
        team_name = record.get("team_name", "Individual")
        if team_name not in team_summary:
            team_summary[team_name] = {
                "total_employees": 0,
                "total_tasks_assigned": 0,
                "total_tasks_completed": 0,
                "total_idle_minutes": 0,
                "total_overtime_minutes": 0,
            }

        team_summary[team_name]["total_employees"] += 1
        team_summary[team_name]["total_tasks_assigned"] += record["tasks_assigned"]
        team_summary[team_name]["total_tasks_completed"] += record["tasks_completed"]
        team_summary[team_name]["total_idle_minutes"] += record["idle_minutes"]
        team_summary[team_name]["total_overtime_minutes"] += record["overtime_minutes"]

    for stats in team_summary.values():
        stats["productivity_score"] = calculate_productivity_score(
            {
                "tasks_assigned": stats["total_tasks_assigned"],
                "tasks_completed": stats["total_tasks_completed"],
                "idle_minutes": stats["total_idle_minutes"],
                "overtime_minutes": stats["total_overtime_minutes"],
            }
        )

    return {"weekly_team_score": team_summary}


@router.get("/dashboard/analytics")
def dashboard_analytics():
    if employee_activity_collection is None:
        return JSONResponse(status_code=503, content={"success": False, "message": "Database offline"})

    records = list(employee_activity_collection.find({}, {"_id": 0}))
    total_employees = len(records)
    total_tasks_assigned = sum(r["tasks_assigned"] for r in records)
    total_tasks_completed = sum(r["tasks_completed"] for r in records)
    total_idle_minutes = sum(r["idle_minutes"] for r in records)
    total_overtime_minutes = sum(r["overtime_minutes"] for r in records)

    productivity_score = calculate_productivity_score(
        {
            "tasks_assigned": total_tasks_assigned,
            "tasks_completed": total_tasks_completed,
            "idle_minutes": total_idle_minutes,
            "overtime_minutes": total_overtime_minutes,
        }
    )

    team_scores: dict[str, list[float]] = {}
    for record in records:
        team = record.get("team_name", "Unknown")
        team_scores.setdefault(team, []).append(calculate_productivity_score(record))

    performance_index = []
    for team, scores in team_scores.items():
        avg_score = round(sum(scores) / len(scores), 2)
        status = "Excellent"
        if avg_score < 80:
            status = "Average"
        elif avg_score < 90:
            status = "Good"
        performance_index.append({"dept": team, "score": avg_score, "status": status})

    return {
        "kpi_metrics": [
            {"label": "AI Hiring Success", "value": "94.2%", "change": "+2.4% vs last month", "color": "#3b82f6"},
            {"label": "Predicted Attrition", "value": "4.8%", "change": "-1.2% vs last month", "color": "#ef4444"},
            {"label": "Workforce Efficiency", "value": f"{productivity_score}%", "change": "+5.1% vs last month", "color": "#8b5cf6"},
            {"label": "Avg Time to Hire", "value": "14 Days", "change": "3 Days faster", "color": "#f59e0b"},
        ],
        "performance_index": performance_index,
        "attrition_data": [
            {"label": "High Risk", "value": "18%", "color": "#ef4444"},
            {"label": "Medium Risk", "value": "22%", "color": "#f59e0b"},
            {"label": "Low Risk", "value": "60%", "color": "#10b981"},
        ],
        "attendance_data": [
            {"label": "Average Present", "value": "92%", "change": "+4% vs last week", "color": "#10b981"},
            {"label": "Average Absent", "value": "8%", "change": "-4% vs last week", "color": "#ef4444"},
        ],
        "workforce_data": [
            {"label": "Total Employees", "value": str(total_employees), "color": "#3b82f6"},
            {"label": "Retention Rate", "value": "94.2%", "color": "#10b981"},
            {"label": "Diversity Index", "value": "78%", "color": "#8b5cf6"},
            {"label": "Open Positions", "value": "27", "color": "#f59e0b"},
        ],
        "team_heatmap_data": [
            {"team": team, "d1": 4, "d2": 5, "d3": 3, "d4": 5, "d5": 4}
            for team in team_scores.keys()
        ],
    }
