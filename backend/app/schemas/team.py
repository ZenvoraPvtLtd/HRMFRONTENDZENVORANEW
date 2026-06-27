# from pydantic import BaseModel
# from typing import List, Optional

# class TeamCreate(BaseModel):
#     team_name: str
#     department: str
#     team_leader: str
#     team_description: Optional[str] = None
#     members: List[str]

from pydantic import BaseModel
from typing import List, Optional


class TeamCreate(BaseModel):
    team_name: str
    department: str
    team_leader: str
    team_description: Optional[str] = None
    members: List[str]