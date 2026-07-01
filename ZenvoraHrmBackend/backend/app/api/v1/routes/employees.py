from __future__ import annotations

from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


router = APIRouter(prefix="/employees", tags=["employees"])

employees: List[Dict[str, Any]] = []


class Employee(BaseModel):
    name: str
    email: str
    department: str
    role: str
    productivity: int
    status: str


@router.get("")
def get_employees() -> List[Dict[str, Any]]:
    return employees


@router.get("/stats/summary")
def get_employee_stats() -> Dict[str, int]:
    total_employees = len(employees)
    active_employees = len([e for e in employees if e["status"] == "Active"])
    remote_employees = len([e for e in employees if "remote" in e["department"].lower()])
    avg_productivity = (
        sum(e["productivity"] for e in employees) / total_employees
        if total_employees > 0
        else 0
    )

    return {
        "totalEmployees": total_employees,
        "activeEmployees": active_employees,
        "remoteEmployees": remote_employees,
        "avgProductivity": round(avg_productivity),
    }


@router.get("/{employee_id}")
def get_employee(employee_id: str) -> Dict[str, Any]:
    for employee in employees:
        if employee["id"] == employee_id:
            return employee
    raise HTTPException(status_code=404, detail="Employee not found")


@router.post("")
def create_employee(employee: Employee) -> Dict[str, Any]:
    new_employee = {"id": str(uuid4()), **employee.model_dump()}
    employees.append(new_employee)
    return {"message": "Employee created", "employee": new_employee}


@router.put("/{employee_id}")
def update_employee(employee_id: str, updated_employee: Employee) -> Dict[str, Any]:
    for index, employee in enumerate(employees):
        if employee["id"] == employee_id:
            employees[index] = {"id": employee_id, **updated_employee.model_dump()}
            return {"message": "Employee updated", "employee": employees[index]}
    raise HTTPException(status_code=404, detail="Employee not found")


@router.delete("/{employee_id}")
def delete_employee(employee_id: str) -> Dict[str, Any]:
    for index, employee in enumerate(employees):
        if employee["id"] == employee_id:
            deleted_employee = employees.pop(index)
            return {"message": "Employee deleted", "employee": deleted_employee}
    raise HTTPException(status_code=404, detail="Employee not found")
