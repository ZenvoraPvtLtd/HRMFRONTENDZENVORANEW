from typing import Optional

from pydantic import BaseModel, Field


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phoneNumber: Optional[str] = None
    dateOfBirth: Optional[str] = None
    address: Optional[str] = None
    emergencyContactName: Optional[str] = None
    emergencyContactPhone: Optional[str] = None
    bankAccountDetails: Optional[str] = None
    uanNumber: Optional[str] = None
    skills: Optional[list[str]] = None
    reportingTime: Optional[str] = None
    workingHoursPerDay: Optional[int] = Field(default=None, ge=1, le=24)
    email: Optional[str] = None
    role: Optional[str] = None
    provider: Optional[str] = None
    employeeId: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    joiningDate: Optional[str] = None
    managerName: Optional[str] = None
    teamSize: Optional[int] = None


class ProfileResponse(BaseModel):
    id: str
    _id: str
    name: str
    fullName: str
    email: str
    phoneNumber: Optional[str] = ""
    role: str
    provider: Optional[str] = "local"
    avatar: Optional[str] = None
    employeeId: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    managerName: Optional[str] = None
    teamSize: Optional[int] = None
    joiningDate: Optional[str] = None
    dateOfBirth: Optional[str] = None
    address: Optional[str] = None
    emergencyContactName: Optional[str] = None
    emergencyContactPhone: Optional[str] = None
    bankAccountDetails: Optional[str] = None
    uanNumber: Optional[str] = None
    skills: Optional[list[str]] = None
    reportingTime: Optional[str] = None
    workingHoursPerDay: Optional[int] = None
    profileCompletion: Optional[int] = 0
    createdAt: str = ""
    updatedAt: str = ""


class ProfileResponseWrapper(BaseModel):
    success: bool
    user: ProfileResponse
